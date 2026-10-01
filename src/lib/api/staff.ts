import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, sellers, settings, smsTemplates, tickets, users, sellerShipments, sellerPosItems } from "@/db/schema";
import { requireApi, rateLimit, hashPassword } from "../auth";
import { audit } from "../audit";
import { postJournal, reverseJournal } from "../accounting";
import { HttpError, int, str } from "../util";
import { PERMISSIONS, ROLES } from "../rbac";
import { DEFAULT_SETTINGS } from "../settings";
import { sendSms, SMS_EVENTS } from "../sms";
import { cancelOrder, payOrder, updateShipment } from "../services/orders";
import { receiveStock, saveProduct, setBuyBox, setOfferStatus, setProductStatus, upsertOffer } from "../services/catalog";
import { requestWithdrawal, reviewWithdrawal } from "../services/wallet";
import { sellerQuote, staffSupplyAction, type SupplyAction } from "../services/supply";
import { body, idParam, type Route } from "./router";
import { assertSellerAllowed } from "../services/kyc";

async function requireSeller() {
  const u = await requireApi();
  if (!u.sellerId) throw new HttpError(403, "فقط تأمین‌کنندگان");
  return u as typeof u & { sellerId: number };
}

export const staffRoutes: Route[] = [
  // ---------- products (seller or staff) ----------
  { method: "POST", pattern: "products", handler: async (req, _p, m) => {
    const u = await requireApi();
    if (!u.sellerId && !u.staff) throw new HttpError(403, "دسترسی غیرمجاز");
    if (u.sellerId && !u.staff) await assertSellerAllowed(u.sellerId, "ثبت محصول جدید");
    return saveProduct({ userId: u.id, ...m }, u, await body(req));
  } },
  { method: "PUT", pattern: "products/:id", handler: async (req, p, m) => {
    const u = await requireApi();
    if (!u.sellerId && !u.staff) throw new HttpError(403, "دسترسی غیرمجاز");
    if (u.sellerId && !u.staff) await assertSellerAllowed(u.sellerId, "ویرایش محصول");
    return saveProduct({ userId: u.id, ...m }, u, await body(req), idParam(p.id));
  } },
  { method: "POST", pattern: "products/:id/status", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const status = String(b.status);
    if (!["draft", "pending", "approved", "active", "inactive", "out_of_stock", "rejected", "suspended", "deleted"].includes(status)) throw new HttpError(400, "وضعیت نامعتبر");
    await setProductStatus({ userId: u.id, ...m }, u, idParam(p.id), status, str(b.reason, 500));
    return { ok: true };
  } },

  // ---------- seller ----------
  { method: "POST", pattern: "seller/offers", handler: async (req, _p, m) => {
    const u = await requireSeller();
    await assertSellerAllowed(u.sellerId, "ثبت یا ویرایش پیشنهاد فروش");
    return upsertOffer({ userId: u.id, ...m }, u.sellerId, await body(req));
  } },
  { method: "POST", pattern: "seller/offers/:id/status", handler: async (req, p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    if (String(b.status) === "approved") await assertSellerAllowed(u.sellerId, "فعال‌سازی پیشنهاد");
    await setOfferStatus({ userId: u.id, ...m }, idParam(p.id), String(b.status), { sellerId: u.sellerId, staff: false });
    return { ok: true };
  } },
  { method: "POST", pattern: "seller/shipments/:id", handler: async (req, p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    return updateShipment({ userId: u.id, ...m }, idParam(p.id), { status: String(b.status), carrier: str(b.carrier, 60), trackingNumber: str(b.trackingNumber, 60), carrierId: b.carrierId ? int(b.carrierId, 1) : null, shippedAt: /^\d{4}-\d{2}-\d{2}$/.test(str(b.shippedAt, 10)) ? new Date(`${str(b.shippedAt, 10)}T12:00:00+03:30`) : undefined, packageCount: b.packageCount ? int(b.packageCount, 1, 50) : undefined, notes: str(b.notes, 500) || undefined }, { sellerId: u.sellerId, staff: false });
  } },
  { method: "POST", pattern: "seller/withdrawals", handler: async (req, _p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    const key = str(b.idempotencyKey, 100);
    if (key.length < 8) throw new HttpError(400, "کلید یکتا الزامی است");
    await assertSellerAllowed(u.sellerId, "درخواست برداشت وجه");
    const wd = await requestWithdrawal({ userId: u.id, ...m }, u.sellerId, int(b.amount, 1), str(b.iban, 30).replace(/\s/g, "").toUpperCase(), `wd:${u.sellerId}:${key}`);
    return { id: wd.id, status: wd.status };
  } },
  { method: "POST", pattern: "seller/withdrawals/:id/cancel", handler: async (_r, p, m) => {
    const u = await requireSeller();
    const wd = await reviewWithdrawal({ userId: u.id, ...m }, idParam(p.id), "cancel", undefined, "لغو توسط فروشنده", u.sellerId);
    return { id: wd.id, status: wd.status };
  } },
  { method: "POST", pattern: "seller/rfq/:id", handler: async (req, p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    await assertSellerAllowed(u.sellerId, "پاسخ به RFQ");
    await sellerQuote({ userId: u.id, ...m }, u.sellerId, idParam(p.id), { price: int(b.price, 1000), stock: int(b.stock ?? 0, 0, 10000), leadDays: int(b.leadDays ?? 0, 0, 120), brand: str(b.brand, 60), note: str(b.note, 500) });
    return { ok: true };
  } },
  { method: "GET", pattern: "seller/report.csv", handler: async () => {
    const u = await requireSeller();
    const result = await db.execute(sql`select product, sum(qty)::int qty, sum(gross)::bigint gross, sum(commission)::bigint commission from (
      select oi.title product, oi.qty, oi.line_total gross, round(oi.line_total * s.commission_rate / 100.0)::bigint commission
        from order_items oi join seller_shipments sh on sh.id = oi.shipment_id join orders o on o.id = oi.order_id join sellers s on s.id = sh.seller_id
        where oi.seller_id = ${u.sellerId} and o.payment_status = 'paid' and sh.status <> 'cancelled'
      union all select pi.title product, pi.quantity qty, pi.line_total gross, 0::bigint commission
        from seller_pos_items pi where pi.seller_id = ${u.sellerId}
    ) sales group by product order by gross desc`);
    const rows = result.rows as { product: string; qty: number; gross: number; commission: number }[];
    const lines = ["product,qty,gross,commission,net", ...rows.map((r) => {
      const c = Number(r.commission);
      return `"${r.product.replace(/"/g, "'")}",${r.qty},${r.gross},${c},${Number(r.gross) - c}`;
    })];
    return new Response("\uFEFF" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=seller-report.csv" } });
  } },

  // ---------- admin ----------
  { method: "POST", pattern: "admin/offers/:id/status", handler: async (req, p, m) => {
    const u = await requireApi("SUPPLIER_OFFERS_MANAGE");
    const b = await body(req);
    await setOfferStatus({ userId: u.id, ...m }, idParam(p.id), String(b.status), { staff: true });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/offers/:id/buybox", handler: async (_r, p, m) => {
    const u = await requireApi("SUPPLIER_OFFERS_MANAGE");
    await setBuyBox({ userId: u.id, ...m }, idParam(p.id));
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sellers/:id", handler: async (req, p, m) => {
    const u = await requireApi("SELLER_SETTLEMENT_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [old] = await db.select().from(sellers).where(eq(sellers.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    const patch = {
      status: ["pending", "approved", "rejected", "suspended"].includes(String(b.status)) ? String(b.status) : old.status,
      contractStatus: ["pending", "signed", "expired"].includes(String(b.contractStatus)) ? String(b.contractStatus) : old.contractStatus,
      commissionRate: b.commissionRate !== undefined && b.commissionRate !== "" ? int(b.commissionRate, 0, 50) : old.commissionRate,
      settlementDays: b.settlementDays !== undefined && b.settlementDays !== "" ? int(b.settlementDays, 0, 90) : old.settlementDays,
    };
    await db.update(sellers).set(patch).where(eq(sellers.id, id));
    await audit(db, { userId: u.id, ...m }, "seller.update", "seller", id, { status: old.status, commissionRate: old.commissionRate }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/shipments/:id", handler: async (req, p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const b = await body(req);
    return updateShipment({ userId: u.id, ...m }, idParam(p.id), { status: String(b.status), carrier: str(b.carrier, 60), trackingNumber: str(b.trackingNumber, 60), carrierId: b.carrierId ? int(b.carrierId, 1) : null, shippedAt: /^\d{4}-\d{2}-\d{2}$/.test(str(b.shippedAt, 10)) ? new Date(`${str(b.shippedAt, 10)}T12:00:00+03:30`) : undefined, packageCount: b.packageCount ? int(b.packageCount, 1, 50) : undefined, notes: str(b.notes, 500) || undefined }, { sellerId: null, staff: true });
  } },
  { method: "POST", pattern: "admin/orders/:id/cancel", handler: async (req, p, m) => {
    const u = await requireApi("ORDERS_MANAGE");
    const b = await body(req);
    await cancelOrder({ userId: u.id, ...m }, idParam(p.id), { staff: true }, str(b.reason, 300) || "لغو توسط مدیر");
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/orders/:id/pay", handler: async (req, p, m) => {
    const u = await requireApi("PAYMENTS_MANAGE");
    const b = await body(req);
    await payOrder({ userId: u.id, ...m }, idParam(p.id), `adm:${str(b.idempotencyKey, 100)}`, true);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/withdrawals/:id", handler: async (req, p, m) => {
    const u = await requireApi("WITHDRAWALS_MANAGE");
    const b = await body(req);
    const action = String(b.action);
    if (!["approve", "reject", "process", "pay"].includes(action)) throw new HttpError(400, "عملیات نامعتبر");
    const wd = await reviewWithdrawal({ userId: u.id, ...m }, idParam(p.id), action as "approve", str(b.trackingCode, 60) || undefined, str(b.note, 300) || undefined);
    return { id: wd.id, status: wd.status, trackingCode: wd.trackingCode };
  } },
  { method: "POST", pattern: "admin/supply/:id", handler: async (req, p, m) => {
    const u = await requireApi("SUPPLY_REQUESTS_MANAGE");
    const b = await body(req);
    const a = { ...b, action: String(b.action) } as unknown as SupplyAction;
    if (!["review", "search", "rfq", "select_quote", "calculate", "send_quotation", "assign", "advance", "reject"].includes(a.action)) throw new HttpError(400, "عملیات نامعتبر");
    await staffSupplyAction({ userId: u.id, ...m }, idParam(p.id), a);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/inventory/:id", handler: async (req, p, m) => {
    const u = await requireApi("INVENTORY_MANAGE");
    const b = await body(req);
    const qty = Math.trunc(Number(b.qty));
    if (!Number.isFinite(qty) || qty === 0 || Math.abs(qty) > 100000) throw new HttpError(400, "تعداد نامعتبر");
    await receiveStock({ userId: u.id, ...m }, idParam(p.id), qty, int(b.unitCost ?? 0), int(b.freight ?? 0), int(b.customs ?? 0), str(b.note, 300));
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/journal", handler: async (req, _p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const b = await body(req);
    const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]).map((l) => ({ code: str(l.code, 10), debit: int(l.debit ?? 0), credit: int(l.credit ?? 0), detail1: str(l.detail1, 60) || undefined })) : [];
    if (lines.length < 2) throw new HttpError(400, "سند حداقل دو آرتیکل دارد");
    const d = lines.reduce((a, l) => a + l.debit, 0), c = lines.reduce((a, l) => a + l.credit, 0);
    if (d !== c) throw new HttpError(400, "جمع بدهکار و بستانکار برابر نیست");
    const e = await db.transaction(async (tx) => {
      const e = await postJournal(tx, str(b.description, 300) || "سند دستی", lines, { type: "manual", id: 0 }, u.id);
      await audit(tx, { userId: u.id, ...m }, "journal.create", "journal", e?.id ?? null, null, { lines: lines.length, amount: d });
      return e;
    });
    return { id: e?.id };
  } },
  { method: "POST", pattern: "admin/journal/:id/reverse", handler: async (_r, p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    await db.transaction(async (tx) => {
      await reverseJournal(tx, idParam(p.id), "برگشت دستی", u.id);
      await audit(tx, { userId: u.id, ...m }, "journal.reverse", "journal", p.id);
    });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/tickets/:id", handler: async (req, p, m) => {
    const u = await requireApi("TICKETS_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!t) throw new HttpError(404, "یافت نشد");
    const patch = {
      status: ["open", "in_review", "pending_customer", "pending_staff", "resolved", "closed"].includes(String(b.status)) ? String(b.status) : t.status,
      priority: ["low", "normal", "high", "urgent"].includes(String(b.priority)) ? String(b.priority) : t.priority,
      assigneeId: b.assigneeId ? int(b.assigneeId, 1) : t.assigneeId, updatedAt: new Date(),
    };
    await db.update(tickets).set(patch).where(eq(tickets.id, id));
    await audit(db, { userId: u.id, ...m }, "ticket.update", "ticket", id, { status: t.status, assigneeId: t.assigneeId }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sms/test", handler: async (req) => {
    const u = await requireApi("SMS_MANAGE");
    rateLimit(`smstest:${u.id}`, 5, 60_000);
    const b = await body(req);
    const event = String(b.event);
    if (!SMS_EVENTS[event]) throw new HttpError(400, "رویداد نامعتبر");
    const phone = str(b.phone, 20);
    if (!/^09\d{9}$/.test(phone)) throw new HttpError(400, "شماره نامعتبر");
    const vars = Object.fromEntries(SMS_EVENTS[event].vars.map((v) => [v, "نمونه"]));
    return sendSms(event, phone, vars, true);
  } },
  { method: "POST", pattern: "admin/sms/:id", handler: async (req, p, m) => {
    const u = await requireApi("SMS_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [t] = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id));
    if (!t) throw new HttpError(404, "یافت نشد");
    const patch = { isActive: b.isActive !== undefined ? b.isActive === true : t.isActive, patternId: b.patternId !== undefined ? str(b.patternId, 40) : t.patternId, body: b.body !== undefined ? str(b.body, 500) || t.body : t.body };
    await db.update(smsTemplates).set(patch).where(eq(smsTemplates.id, id));
    await audit(db, { userId: u.id, ...m }, "sms.template_update", "sms_template", id, { isActive: t.isActive, patternId: t.patternId }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/settings", handler: async (req, _p, m) => {
    const u = await requireApi("SETTINGS_MANAGE");
    const b = await body(req);
    const changes: Record<string, unknown> = {};
    for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(k in b)) continue;
      const v = typeof def === "number" ? int(b[k], 0, 1_000_000_000) : str(b[k], 1000);
      if (k === "paymentGateway" && v !== "zarinpal" && v !== "zibal") throw new HttpError(400, "درگاه پرداخت نامعتبر است");
      changes[k] = v;
      await db.insert(settings).values({ key: k, value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } });
    }
    await audit(db, { userId: u.id, ...m }, "settings.update", "settings", null, null, changes);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/users", handler: async (req, _p, m) => {
    const u = await requireApi("USERS_MANAGE");
    const b = await body(req);
    const role = String(b.role);
    if (!(role in ROLES) || role === "seller") throw new HttpError(400, "نقش نامعتبر");
    const phone = str(b.phone, 20), password = str(b.password, 100);
    if (!/^09\d{9}$/.test(phone) || password.length < 8) throw new HttpError(400, "موبایل یا رمز نامعتبر");
    const [nu] = await db.insert(users).values({ name: str(b.name, 100) || phone, phone, role, passwordHash: hashPassword(password) }).returning({ id: users.id });
    await audit(db, { userId: u.id, ...m }, "user.create", "user", nu.id, null, { role });
    return nu;
  } },
  { method: "POST", pattern: "admin/users/:id", handler: async (req, p, m) => {
    const u = await requireApi("USERS_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [old] = await db.select().from(users).where(eq(users.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    if (id === u.id && b.isActive === false) throw new HttpError(400, "نمی‌توانید حساب خود را غیرفعال کنید");
    const patch = {
      role: typeof b.role === "string" && b.role in ROLES && old.role !== "seller" && b.role !== "seller" ? b.role : old.role,
      isActive: b.isActive !== undefined ? b.isActive === true : old.isActive,
      extraPermissions: Array.isArray(b.extraPermissions) ? (b.extraPermissions as string[]).filter((x) => (PERMISSIONS as readonly string[]).includes(x)) : old.extraPermissions,
    };
    await db.update(users).set(patch).where(eq(users.id, id));
    await audit(db, { userId: u.id, ...m }, "user.permissions_change", "user", id, { role: old.role, isActive: old.isActive, extra: old.extraPermissions }, patch);
    return { ok: true };
  } },
];
