import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, detailAccounts, discountCodes, incompleteCarts, journalLines, media, products, productVariants, sellers, smsTemplates, ticketDepartments, tickets, users } from "@/db/schema";
import { requireApi, rateLimit, hashPassword, verifyPassword } from "../auth";
import { audit } from "../audit";
import { postJournal } from "../accounting";
import { HttpError, int, slugify, str } from "../util";
import { SMS_EVENTS, extractVars, retryLog, sendSms, sendTemplateTo } from "../sms";
import { body, idParam, type Route } from "./router";

function parseDate(v: unknown) {
  const s = str(v, 10);
  if (!s) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, "تاریخ نامعتبر");
  const d = new Date(`${s}T12:00:00+03:30`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "تاریخ نامعتبر");
  return d;
}

function faqs(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).map((x) => {
    const row = x && typeof x === "object" ? x as Record<string, unknown> : {};
    return { question: str(row.question, 300), answer: str(row.answer, 2000) };
  }).filter((x) => x.question && x.answer);
}

export const extraRoutes: Route[] = [
  { method: "POST", pattern: "admin/product-prices", handler: async (req, _p, m) => {
    const u = await requireApi("PRODUCTS_EDIT"), b = await body(req), productId = int(b.productId, 1);
    const cost = int(b.cost ?? 0, 0, 1_000_000_000_000), price = int(b.price ?? 0, 0, 1_000_000_000_000), sale = int(b.sale ?? 0, 0, 1_000_000_000_000);
    const variantId = b.variantId ? int(b.variantId, 1) : null;
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) throw new HttpError(404, "محصول پیدا نشد");
    if (variantId) {
      const [variant] = await db.select().from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
      if (!variant) throw new HttpError(404, "تنوع محصول پیدا نشد");
      await db.update(productVariants).set({ costPrice: cost, price, compareAtPrice: sale }).where(eq(productVariants.id, variantId));
    } else await db.update(products).set({ basePrice: price, avgCost: cost, compareAtPrice: sale, updatedAt: new Date() }).where(eq(products.id, productId));
    await audit(db, { userId: u.id, ...m }, "product.price_quick_update", "product", productId, { avgCost: product.avgCost, basePrice: product.basePrice, compareAtPrice: product.compareAtPrice }, { cost, price, sale, variantId });
    return { ok: true };
  } },
  // ---------- cart recovery ----------
  { method: "POST", pattern: "cart/recovery", handler: async (req) => {
    const u = await requireApi();
    const b = await body(req);
    if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 50) throw new HttpError(400, "اقلام سبد نامعتبر است");
    const recoveryKey = str(b.recoveryKey, 80);
    if (!/^[\w-]{8,80}$/.test(recoveryKey)) throw new HttpError(400, "شناسه سبد نامعتبر است");
    const items = b.items.slice(0, 50).map((raw) => {
      const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      return { productId: int(row.productId, 1), variantId: row.variantId ? int(row.variantId, 1) : null, offerId: row.offerId ? int(row.offerId, 1) : null, qty: int(row.qty, 1, 100), title: str(row.title, 160) };
    });
    await db.insert(incompleteCarts).values({ cartKey: `user-${u.id}-${recoveryKey}`, customerId: u.id, customerName: u.name, phone: u.phone, items, reason: "مشتری پس از افزودن کالا سبد خرید را تکمیل نکرد", status: "open", updatedAt: new Date() })
      .onConflictDoUpdate({ target: incompleteCarts.cartKey, set: { customerId: u.id, customerName: u.name, phone: u.phone, items, status: sql`CASE WHEN ${incompleteCarts.status} IN ('checkout_started','completed') THEN ${incompleteCarts.status} ELSE 'open' END`, updatedAt: new Date() } });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/incomplete-carts/:id", handler: async (req, p, m) => {
    const u = await requireApi("SMS_MANAGE"), id = idParam(p.id), b = await body(req);
    const [row] = await db.select().from(incompleteCarts).where(eq(incompleteCarts.id, id));
    if (!row) throw new HttpError(404, "سبد پیدا نشد");
    if (b.reason !== undefined) {
      const reason = str(b.reason, 500);
      if (!reason) throw new HttpError(400, "دلیل ناقص ماندن سفارش را وارد کنید");
      await db.update(incompleteCarts).set({ reason, updatedAt: new Date() }).where(eq(incompleteCarts.id, id));
      await audit(db, { userId: u.id, ...m }, "incomplete_cart.reason", "incomplete_cart", id, { reason: row.reason }, { reason });
      return { ok: true };
    }
    const action = str(b.action, 20);
    if (action !== "reminder" && action !== "discount") throw new HttpError(400, "نوع پیام نامعتبر است");
    const [customer] = row.customerId ? await db.select({ smsConsent: users.smsConsent }).from(users).where(eq(users.id, row.customerId)) : [];
    if (!customer?.smsConsent) throw new HttpError(403, "مشتری اجازه دریافت پیامک تبلیغاتی نداده است");
    const settingsRow = await import("../settings").then((x) => x.getSettings());
    const url = `${settingsRow.siteUrl.replace(/\/$/, "")}/cart`;
    let code: string | undefined, discountCodeId: number | undefined;
    if (action === "discount") {
      const value = int(b.percent ?? 10, 1, 50);
      code = `CART${randomBytes(4).toString("hex").toUpperCase()}`;
      const [createdCode] = await db.insert(discountCodes).values({ code, title: "تخفیف تکمیل سبد خرید", type: "percent", value, maxDiscount: 300000, minOrder: 0, startsAt: new Date(), endsAt: new Date(Date.now() + 7 * 86400000), usageLimit: 1, perUserLimit: 1, customerId: row.customerId, targetPhone: row.phone, isActive: true }).returning({ id: discountCodes.id });
      discountCodeId = createdCode.id;
    }
    const result = await sendSms(action === "discount" ? "cart_discount" : "cart_reminder", row.phone, { name: row.customerName, url, ...(code ? { code } : {}) });
    const sent = result.status === "sent" || result.status === "simulated";
    await db.update(incompleteCarts).set({ lastSmsType: action, lastSmsStatus: result.status, lastSmsAt: sent ? new Date() : row.lastSmsAt, discountCodeId: discountCodeId ?? row.discountCodeId, updatedAt: new Date() }).where(eq(incompleteCarts.id, id));
    await audit(db, { userId: u.id, ...m }, `incomplete_cart.sms_${action}`, "incomplete_cart", id, null, { phone: row.phone, status: result.status, discountCodeId });
    return { status: result.status, code };
  } },
  // ---------- categories ----------
  { method: "POST", pattern: "admin/categories", handler: async (req, _p, m) => {
    const u = await requireApi("PRODUCTS_EDIT");
    const b = await body(req);
    const name = str(b.name, 80);
    if (!name) throw new HttpError(400, "نام دسته الزامی است");
    const [c] = await db.insert(categories).values({ name, slug: slugify(str(b.slug, 80) || name), parentId: b.parentId ? int(b.parentId, 1) : null, description: str(b.description, 50000) || null, seoTitle: str(b.seoTitle, 160) || null, metaDescription: str(b.metaDescription, 320) || null, seoKeywords: str(b.seoKeywords, 500) || null, canonicalUrl: str(b.canonicalUrl, 500) || null, faqs: faqs(b.faqs), sortOrder: int(b.sortOrder ?? 0, 0, 1000) }).returning();
    await audit(db, { userId: u.id, ...m }, "category.create", "category", c.id, null, c);
    return c;
  } },
  { method: "POST", pattern: "admin/categories/:id", handler: async (req, p, m) => {
    const u = await requireApi("PRODUCTS_EDIT");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(categories).where(eq(categories.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    if (b.delete === true) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(products).where(and(eq(products.categoryId, id), sql`${products.status} <> 'deleted'`));
      const [{ k }] = await db.select({ k: sql<number>`count(*)::int` }).from(categories).where(eq(categories.parentId, id));
      if (n > 0 || k > 0) throw new HttpError(400, "این دسته دارای محصول یا زیر‌دسته است و قابل حذف نیست");
      await db.delete(categories).where(eq(categories.id, id));
      await audit(db, { userId: u.id, ...m }, "category.delete", "category", id, old, null);
      return { ok: true };
    }
    const parentId = b.parentId ? int(b.parentId, 1) : null;
    if (parentId === id) throw new HttpError(400, "دسته نمی‌تواند والد خودش باشد");
    const patch = { name: str(b.name, 80) || old.name, slug: slugify(str(b.slug, 80) || old.slug), parentId, description: str(b.description, 50000) || null, seoTitle: str(b.seoTitle, 160) || null, metaDescription: str(b.metaDescription, 320) || null, seoKeywords: str(b.seoKeywords, 500) || null, canonicalUrl: str(b.canonicalUrl, 500) || null, faqs: faqs(b.faqs), sortOrder: int(b.sortOrder ?? old.sortOrder, 0, 1000) };
    await db.update(categories).set(patch).where(eq(categories.id, id));
    await audit(db, { userId: u.id, ...m }, "category.update", "category", id, old, patch);
    return { ok: true };
  } },

  // ---------- ticket departments ----------
  { method: "POST", pattern: "admin/ticket-departments", handler: async (req, _p, m) => {
    const u = await requireApi("TICKETS_MANAGE");
    const b = await body(req);
    const name = str(b.name, 80);
    if (!name) throw new HttpError(400, "نام دپارتمان الزامی است");
    const key = (str(b.key, 40) || `dep-${Date.now().toString(36)}`).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const [d] = await db.insert(ticketDepartments).values({ key, name, description: str(b.description, 300) || null, sortOrder: int(b.sortOrder ?? 0, 0, 1000) }).returning();
    await audit(db, { userId: u.id, ...m }, "ticket_department.create", "ticket_department", d.id, null, d);
    return d;
  } },
  { method: "POST", pattern: "admin/ticket-departments/:id", handler: async (req, p, m) => {
    const u = await requireApi("TICKETS_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(ticketDepartments).where(eq(ticketDepartments.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    const patch = { name: str(b.name, 80) || old.name, description: b.description !== undefined ? str(b.description, 300) || null : old.description, isActive: b.isActive !== undefined ? b.isActive === true : old.isActive, sortOrder: b.sortOrder !== undefined ? int(b.sortOrder, 0, 1000) : old.sortOrder };
    await db.update(ticketDepartments).set(patch).where(eq(ticketDepartments.id, id));
    await audit(db, { userId: u.id, ...m }, "ticket_department.update", "ticket_department", id, old, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/tickets/:id/refer", handler: async (req, p, m) => {
    const u = await requireApi("TICKETS_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!t) throw new HttpError(404, "یافت نشد");
    const [dep] = await db.select().from(ticketDepartments).where(eq(ticketDepartments.key, str(b.department, 40)));
    if (!dep) throw new HttpError(400, "دپارتمان نامعتبر");
    await db.update(tickets).set({ department: dep.key, assigneeId: b.assigneeId ? int(b.assigneeId, 1) : null, status: "in_review", updatedAt: new Date() }).where(eq(tickets.id, id));
    await audit(db, { userId: u.id, ...m }, "ticket.refer", "ticket", id, { department: t.department, assigneeId: t.assigneeId }, { department: dep.key, assigneeId: b.assigneeId ?? null });
    return { ok: true };
  } },

  // ---------- SMS templates ----------
  { method: "POST", pattern: "admin/sms-templates", handler: async (req, _p, m) => {
    const u = await requireApi("SMS_MANAGE");
    const b = await body(req);
    const event = str(b.event, 40);
    if (event !== "manual" && !SMS_EVENTS[event]) throw new HttpError(400, "رویداد نامعتبر");
    const text = str(b.body, 600), title = str(b.title, 100);
    if (!text || !title) throw new HttpError(400, "عنوان و متن الگو الزامی است");
    const [t] = await db.insert(smsTemplates).values({ event, title, body: text, patternId: str(b.patternId, 40) || null, variables: extractVars(text), isActive: b.isActive !== false }).returning();
    await audit(db, { userId: u.id, ...m }, "sms.template_create", "sms_template", t.id, null, { event, title });
    return t;
  } },
  { method: "POST", pattern: "admin/sms-templates/:id", handler: async (req, p, m) => {
    const u = await requireApi("SMS_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [t] = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id));
    if (!t) throw new HttpError(404, "یافت نشد");
    if (b.delete === true) {
      if (t.isSystem) throw new HttpError(400, "الگوی سیستمی قابل حذف نیست؛ آن را غیرفعال کنید");
      await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
      await audit(db, { userId: u.id, ...m }, "sms.template_delete", "sms_template", id, { title: t.title }, null);
      return { ok: true };
    }
    const text = b.body !== undefined ? str(b.body, 600) || t.body : t.body;
    const event = b.event !== undefined && (SMS_EVENTS[String(b.event)] || b.event === "manual") ? String(b.event) : t.event;
    const patch = { title: str(b.title, 100) || t.title, body: text, variables: extractVars(text), event: t.isSystem ? t.event : event, patternId: b.patternId !== undefined ? str(b.patternId, 40) || null : t.patternId, isActive: b.isActive !== undefined ? b.isActive === true : t.isActive };
    await db.update(smsTemplates).set(patch).where(eq(smsTemplates.id, id));
    await audit(db, { userId: u.id, ...m }, "sms.template_update", "sms_template", id, { isActive: t.isActive, body: t.body }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sms/send", handler: async (req, _p, m) => {
    const u = await requireApi("SMS_MANAGE");
    rateLimit(`smssend:${u.id}`, 10, 60_000);
    const b = await body(req);
    const templateId = int(b.templateId, 1);
    const vars = (b.vars && typeof b.vars === "object" ? b.vars : {}) as Record<string, string>;
    const clean = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.slice(0, 30), str(v, 100)]));
    let phones: string[] = [];
    const target = String(b.target ?? "phones");
    if (target === "customers") phones = (await db.select({ p: users.phone }).from(users).where(and(eq(users.role, "customer"), eq(users.isActive, true)))).map((x) => x.p);
    else if (target === "sellers") phones = (await db.select({ p: users.phone }).from(sellers).innerJoin(users, eq(users.id, sellers.userId)).where(eq(sellers.status, "approved"))).map((x) => x.p);
    else phones = str(b.phones, 2000).split(/[\s,،]+/).filter(Boolean);
    phones = Array.from(new Set(phones)).filter((x) => /^09\d{9}$/.test(x)).slice(0, 500);
    if (!phones.length) throw new HttpError(400, "هیچ شماره معتبری یافت نشد");
    const r = await sendTemplateTo(templateId, phones, clean);
    await audit(db, { userId: u.id, ...m }, "sms.manual_send", "sms_template", templateId, null, { target, count: phones.length, ...r });
    return r;
  } },
  { method: "POST", pattern: "admin/sms/logs/:id/retry", handler: async (_r, p, m) => {
    const u = await requireApi("SMS_MANAGE");
    rateLimit(`smsretry:${u.id}`, 10, 60_000);
    const st = await retryLog(idParam(p.id));
    if (!st) throw new HttpError(400, "فقط پیامک‌های ناموفق قابل ارسال مجدد هستند");
    await audit(db, { userId: u.id, ...m }, "sms.retry", "sms_log", p.id, null, { status: st });
    return { status: st };
  } },

  // ---------- chart of accounts ----------
  { method: "POST", pattern: "admin/accounts", handler: async (req, _p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const b = await body(req);
    const level = String(b.level);
    if (!["group", "general", "subsidiary"].includes(level)) throw new HttpError(400, "سطح نامعتبر");
    const code = str(b.code, 12), name = str(b.name, 120);
    if (!/^\d{1,12}$/.test(code) || !name) throw new HttpError(400, "کد عددی و نام الزامی است");
    let type = String(b.type);
    let parentId: number | null = null;
    if (level !== "group") {
      const [parent] = await db.select().from(accounts).where(eq(accounts.id, int(b.parentId, 1)));
      if (!parent) throw new HttpError(400, "حساب والد الزامی است");
      if ((level === "general" && parent.level !== "group") || (level === "subsidiary" && parent.level !== "general" && parent.level !== "group")) throw new HttpError(400, "سطح حساب والد نامعتبر است");
      if (!code.startsWith(parent.code)) throw new HttpError(400, `کد باید با کد والد (${parent.code}) شروع شود`);
      parentId = parent.id; type = parent.type;
    } else if (!["asset", "liability", "equity", "revenue", "expense"].includes(type)) throw new HttpError(400, "ماهیت حساب نامعتبر");
    const [a] = await db.insert(accounts).values({ code, name, level, type, parentId }).returning();
    await audit(db, { userId: u.id, ...m }, "account.create", "account", a.id, null, a);
    return a;
  } },
  { method: "POST", pattern: "admin/accounts/:id", handler: async (req, p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [a] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!a) throw new HttpError(404, "یافت نشد");
    if (b.delete === true) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(journalLines).where(eq(journalLines.accountId, id));
      const [{ k }] = await db.select({ k: sql<number>`count(*)::int` }).from(accounts).where(eq(accounts.parentId, id));
      if (n || k) throw new HttpError(400, "حساب دارای گردش یا زیرحساب است و قابل حذف نیست");
      await db.delete(accounts).where(eq(accounts.id, id));
      await audit(db, { userId: u.id, ...m }, "account.delete", "account", id, a, null);
      return { ok: true };
    }
    const name = str(b.name, 120) || a.name;
    await db.update(accounts).set({ name }).where(eq(accounts.id, id));
    await audit(db, { userId: u.id, ...m }, "account.update", "account", id, { name: a.name }, { name });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/detail-accounts", handler: async (req, _p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const b = await body(req);
    const code = str(b.code, 20), name = str(b.name, 120);
    if (!code || !name) throw new HttpError(400, "کد و نام الزامی است");
    let level = 1, parentId: number | null = null;
    if (b.parentId) {
      const [parent] = await db.select().from(detailAccounts).where(eq(detailAccounts.id, int(b.parentId, 1)));
      if (!parent) throw new HttpError(400, "والد نامعتبر");
      if (parent.level >= 3) throw new HttpError(400, "تفصیلی حداکثر ۳ سطح دارد");
      level = parent.level + 1; parentId = parent.id;
    }
    const [d] = await db.insert(detailAccounts).values({ code, name, level, parentId }).returning();
    await audit(db, { userId: u.id, ...m }, "detail_account.create", "detail_account", d.id, null, d);
    return d;
  } },
  { method: "POST", pattern: "admin/detail-accounts/:id", handler: async (req, p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [d] = await db.select().from(detailAccounts).where(eq(detailAccounts.id, id));
    if (!d) throw new HttpError(404, "یافت نشد");
    const patch = { name: str(b.name, 120) || d.name, isActive: b.isActive !== undefined ? b.isActive === true : d.isActive };
    await db.update(detailAccounts).set(patch).where(eq(detailAccounts.id, id));
    await audit(db, { userId: u.id, ...m }, "detail_account.update", "detail_account", id, d, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/journal2", handler: async (req, _p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const b = await body(req);
    const raw = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
    const lines = raw.map((l) => ({
      code: str(l.code, 12), debit: int(l.debit ?? 0), credit: int(l.credit ?? 0), description: str(l.description, 200) || undefined,
      detail1Id: l.detail1Id ? int(l.detail1Id, 1) : null, detail2Id: l.detail2Id ? int(l.detail2Id, 1) : null, detail3Id: l.detail3Id ? int(l.detail3Id, 1) : null,
    })).filter((l) => l.debit > 0 || l.credit > 0);
    if (lines.length < 2) throw new HttpError(400, "سند حداقل دو آرتیکل دارد");
    if (lines.some((l) => l.debit > 0 && l.credit > 0)) throw new HttpError(400, "هر آرتیکل فقط بدهکار یا بستانکار است");
    const d = lines.reduce((a, l) => a + l.debit, 0), c = lines.reduce((a, l) => a + l.credit, 0);
    if (d !== c) throw new HttpError(400, "جمع بدهکار و بستانکار برابر نیست");
    const ids = lines.flatMap((l) => [l.detail1Id, l.detail2Id, l.detail3Id]).filter(Boolean) as number[];
    if (ids.length) {
      const found = await db.select().from(detailAccounts).where(inArray(detailAccounts.id, ids));
      if (found.length !== new Set(ids).size) throw new HttpError(400, "حساب تفصیلی نامعتبر");
      for (const l of lines) for (const [k, lvl] of [["detail1Id", 1], ["detail2Id", 2], ["detail3Id", 3]] as const) {
        const v = l[k];
        if (v && found.find((f) => f.id === v)!.level !== lvl) throw new HttpError(400, `تفصیلی سطح ${lvl} نامعتبر است`);
      }
    }
    const leaf = await db.select().from(accounts).where(inArray(accounts.code, lines.map((l) => l.code)));
    if (leaf.some((a) => a.level !== "subsidiary")) throw new HttpError(400, "ثبت فقط روی حساب معین مجاز است");
    const e = await db.transaction(async (tx) => {
      const e = await postJournal(tx, str(b.description, 300) || "سند دستی", lines, { type: "manual", id: 0 }, u.id, parseDate(b.date));
      await audit(tx, { userId: u.id, ...m }, "journal.create", "journal", e?.id ?? null, null, { lines: lines.length, amount: d, date: b.date });
      return e;
    });
    return { id: e?.id };
  } },

  // ---------- customer profile ----------
  { method: "POST", pattern: "me/avatar", handler: async (req, _p, m) => {
    const u = await requireApi(), b = await body(req), mediaId = b.mediaId ? int(b.mediaId, 1) : null;
    if (mediaId) {
      const [file] = await db.select({ id: media.id }).from(media).where(and(eq(media.id, mediaId), eq(media.uploadedBy, u.id), sql`${media.mime} like 'image/%'`));
      if (!file) throw new HttpError(403, "تصویر پروفایل معتبر نیست");
    }
    await db.update(users).set({ avatarMediaId: mediaId }).where(eq(users.id, u.id));
    await audit(db, { userId: u.id, ...m }, "user.avatar_update", "user", u.id, null, { mediaId });
    return { ok: true, mediaId };
  } },
  { method: "POST", pattern: "me/profile", handler: async (req, _p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const name = str(b.name, 100);
    const email = str(b.email, 120);
    if (!name) throw new HttpError(400, "نام الزامی است");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "ایمیل نامعتبر");
    await db.update(users).set({ name, email: email || null }).where(eq(users.id, u.id));
    await audit(db, { userId: u.id, ...m }, "user.profile_update", "user", u.id, null, { name, email });
    return { ok: true };
  } },
  { method: "POST", pattern: "me/password", handler: async (req, _p, m) => {
    const u = await requireApi();
    rateLimit(`pw:${u.id}`, 5, 60_000);
    const b = await body(req);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    if (!verifyPassword(str(b.current, 200), row.passwordHash)) throw new HttpError(400, "رمز فعلی اشتباه است");
    const next = str(b.next, 200);
    if (next.length < 8) throw new HttpError(400, "رمز جدید حداقل ۸ کاراکتر");
    await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, u.id));
    await audit(db, { userId: u.id, ...m }, "user.password_change", "user", u.id);
    return { ok: true };
  } },
];
