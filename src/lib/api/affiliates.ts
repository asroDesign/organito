import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { affiliateClicks, affiliateEarnings, affiliateProductRules, affiliateProfiles, affiliateProgramSettings, affiliateWithdrawals, detailAccounts, products, users } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { affiliateAvailableBalance } from "../services/affiliates";
import { postJournal } from "../accounting";
import { HttpError, int, str } from "../util";
import { body, idParam, type Route } from "./router";

const tier = (v: unknown) => ["bronze", "silver", "gold"].includes(String(v)) ? String(v) : "bronze";
const pctToBps = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, "درصد پورسانت باید بین صفر و صد باشد");
  return Math.round(n * 100);
};

export const affiliateRoutes: Route[] = [
  { method: "GET", pattern: "customer/affiliate", handler: async () => {
    const u = await requireApi();
    const [[config], [profile], [clickCount], earnings, withdrawals] = await Promise.all([
      db.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1)),
      db.select().from(affiliateProfiles).where(eq(affiliateProfiles.userId, u.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(affiliateClicks).where(eq(affiliateClicks.affiliateUserId, u.id)),
      db.select({ earning: affiliateEarnings, orderNumber: sql<string>`(select number from orders where id=${affiliateEarnings.orderId})` }).from(affiliateEarnings).where(eq(affiliateEarnings.affiliateUserId, u.id)).orderBy(desc(affiliateEarnings.createdAt)).limit(100),
      db.select().from(affiliateWithdrawals).where(eq(affiliateWithdrawals.affiliateUserId, u.id)).orderBy(desc(affiliateWithdrawals.createdAt)).limit(50),
    ]);
    return { enabled: config?.enabled ?? false, config: config ? { minimumWithdrawal: config.minimumWithdrawal, attributionDays: config.attributionDays } : null, profile: profile ?? null, clicks: Number(clickCount?.count ?? 0), earnings, withdrawals, available: profile ? await affiliateAvailableBalance(db, u.id) : 0 };
  } },
  { method: "POST", pattern: "customer/affiliate/apply", handler: async (req, _p, meta) => {
    const u = await requireApi(), b = await body(req);
    const [[config], [old]] = await Promise.all([
      db.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1)),
      db.select().from(affiliateProfiles).where(eq(affiliateProfiles.userId, u.id)),
    ]);
    if (!config?.enabled) throw new HttpError(403, "برنامه همکاری در فروش فعلاً فعال نیست");
    if (b.acceptTerms !== true) throw new HttpError(400, "برای ثبت درخواست، شرایط همکاری را بپذیرید");
    if (old) return { profile: old };
    const code = `ORG${u.id.toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
    const [profile] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(affiliateProfiles).values({ userId: u.id, code, status: "pending", tier: "bronze" }).returning();
      let [parent] = await tx.select().from(detailAccounts).where(eq(detailAccounts.code, "A"));
      if (!parent) {
        const [personRoot] = await tx.select().from(detailAccounts).where(eq(detailAccounts.code, "1"));
        [parent] = await tx.insert(detailAccounts).values({ code: "A", name: "همکاران فروش", level: 2, parentId: personRoot?.id ?? null }).returning();
      }
      const [user] = await tx.select({ name: users.name }).from(users).where(eq(users.id, u.id));
      await tx.insert(detailAccounts).values({ code: `A-${u.id}`, name: user?.name || `همکار ${u.id}`, level: 3, parentId: parent.id }).onConflictDoNothing();
      return [created];
    });
    await audit(db, { userId: u.id, ...meta }, "affiliate.apply", "affiliate", u.id, null, { code, status: "pending" });
    return { profile };
  } },
  { method: "POST", pattern: "customer/affiliate/withdraw", handler: async (req, _p, meta) => {
    const u = await requireApi(), b = await body(req), amount = int(b.amount, 1);
    return db.transaction(async (tx) => {
      const [profile] = await tx.select().from(affiliateProfiles).where(and(eq(affiliateProfiles.userId, u.id), eq(affiliateProfiles.status, "active"))).for("update");
      if (!profile) throw new HttpError(403, "حساب همکاری در فروش فعال نیست");
      const [config] = await tx.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1));
      if (!config?.enabled) throw new HttpError(403, "برنامه همکاری در فروش غیرفعال است");
      const [account] = await tx.select({ bankInfo: users.bankInfo }).from(users).where(eq(users.id, u.id));
      if (!account?.bankInfo?.iban && !account?.bankInfo?.cardNumber) throw new HttpError(400, "ابتدا اطلاعات حساب بانکی را در کیف پول ثبت کنید");
      if (amount < config.minimumWithdrawal) throw new HttpError(400, `حداقل برداشت ${config.minimumWithdrawal.toLocaleString("fa-IR")} تومان است`);
      const available = await affiliateAvailableBalance(tx, u.id);
      if (amount > available) throw new HttpError(400, "موجودی قابل برداشت کافی نیست");
      const [withdrawal] = await tx.insert(affiliateWithdrawals).values({ affiliateUserId: u.id, amount, bankInfo: account.bankInfo }).returning();
      await audit(tx, { userId: u.id, ...meta }, "affiliate.withdrawal_request", "affiliate_withdrawal", withdrawal.id, null, { amount });
      return { withdrawal };
    });
  } },
  { method: "GET", pattern: "admin/affiliates", handler: async () => {
    await requireApi("MARKETING_MANAGE");
    const [config, affiliates, rules, withdrawals, earnings] = await Promise.all([
      db.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1)),
      db.select({ profile: affiliateProfiles, name: users.name, phone: users.phone }).from(affiliateProfiles).innerJoin(users, eq(users.id, affiliateProfiles.userId)).orderBy(desc(affiliateProfiles.createdAt)).limit(500),
      db.select({ rule: affiliateProductRules, name: products.nameFa, sku: products.sku }).from(affiliateProductRules).innerJoin(products, eq(products.id, affiliateProductRules.productId)).orderBy(products.nameFa).limit(1000),
      db.select({ withdrawal: affiliateWithdrawals, name: users.name, phone: users.phone }).from(affiliateWithdrawals).innerJoin(users, eq(users.id, affiliateWithdrawals.affiliateUserId)).orderBy(desc(affiliateWithdrawals.createdAt)).limit(300),
      db.select({ earning: affiliateEarnings, name: users.name, phone: users.phone, orderNumber: sql<string>`(select number from orders where id=${affiliateEarnings.orderId})` }).from(affiliateEarnings).innerJoin(users, eq(users.id, affiliateEarnings.affiliateUserId)).orderBy(desc(affiliateEarnings.createdAt)).limit(500),
    ]);
    const productRows = await db.select({ id: products.id, name: products.nameFa, sku: products.sku, rule: affiliateProductRules }).from(products).leftJoin(affiliateProductRules, eq(affiliateProductRules.productId, products.id)).where(sql`${products.status} <> 'deleted'`).orderBy(products.nameFa).limit(1000);
    const clicks = await db.select({ userId: affiliateClicks.affiliateUserId, count: sql<number>`count(*)::int` }).from(affiliateClicks).groupBy(affiliateClicks.affiliateUserId);
    return { config: config[0] ?? null, affiliates, rules, products: productRows, withdrawals, earnings, clicks };
  } },
  { method: "POST", pattern: "admin/affiliate-program", handler: async (req, _p, meta) => {
    const u = await requireApi("MARKETING_MANAGE"), b = await body(req);
    const bronzeRateBps = pctToBps(b.bronzeRate), silverRateBps = pctToBps(b.silverRate), goldRateBps = pctToBps(b.goldRate);
    const minimumWithdrawal = int(b.minimumWithdrawal, 1000, 1_000_000_000), attributionDays = int(b.attributionDays, 1, 365);
    const [old] = await db.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1));
    const patch = { enabled: b.enabled === true, bronzeRateBps: bronzeRateBps ?? old?.bronzeRateBps ?? 300, silverRateBps: silverRateBps ?? old?.silverRateBps ?? 500, goldRateBps: goldRateBps ?? old?.goldRateBps ?? 700, minimumWithdrawal, attributionDays, updatedAt: new Date() };
    await db.insert(affiliateProgramSettings).values({ id: 1, ...patch }).onConflictDoUpdate({ target: affiliateProgramSettings.id, set: patch });
    await audit(db, { userId: u.id, ...meta }, "affiliate.program_update", "affiliate_program", 1, old ?? null, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/affiliate-products/:id", handler: async (req, p, meta) => {
    const u = await requireApi("MARKETING_MANAGE"), productId = idParam(p.id), b = await body(req);
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
    if (!product) throw new HttpError(404, "محصول پیدا نشد");
    const [old] = await db.select().from(affiliateProductRules).where(eq(affiliateProductRules.productId, productId));
    const patch = { enabled: b.enabled === true, bronzeRateBps: pctToBps(b.bronzeRate), silverRateBps: pctToBps(b.silverRate), goldRateBps: pctToBps(b.goldRate), updatedAt: new Date() };
    if (old) await db.update(affiliateProductRules).set(patch).where(eq(affiliateProductRules.productId, productId));
    else await db.insert(affiliateProductRules).values({ productId, ...patch });
    await audit(db, { userId: u.id, ...meta }, "affiliate.product_rule", "product", productId, old ?? null, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/affiliates/:id", handler: async (req, p, meta) => {
    const u = await requireApi("MARKETING_MANAGE"), userId = idParam(p.id), b = await body(req), status = str(b.status, 20);
    if (!["pending", "active", "suspended"].includes(status)) throw new HttpError(400, "وضعیت همکار معتبر نیست");
    const [old] = await db.select().from(affiliateProfiles).where(eq(affiliateProfiles.userId, userId));
    if (!old) throw new HttpError(404, "همکار پیدا نشد");
    const nextTier = tier(b.tier);
    const patch = { status, tier: nextTier, approvedAt: status === "active" ? old.approvedAt ?? new Date() : old.approvedAt };
    const [updated] = await db.update(affiliateProfiles).set(patch).where(eq(affiliateProfiles.userId, userId)).returning();
    await audit(db, { userId: u.id, ...meta }, "affiliate.profile_update", "affiliate", userId, old, patch);
    return updated;
  } },
  { method: "POST", pattern: "admin/affiliate-withdrawals/:id", handler: async (req, p, meta) => {
    const u = await requireApi("MARKETING_MANAGE"), id = idParam(p.id), b = await body(req), action = str(b.action, 20), note = str(b.note, 300), paymentReference = str(b.paymentReference, 100);
    if (!["paid", "reject"].includes(action)) throw new HttpError(400, "اقدام تسویه معتبر نیست");
    if (action === "paid" && paymentReference.length < 3) throw new HttpError(400, "شماره پیگیری پرداخت تسویه الزامی است");
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(affiliateWithdrawals).where(eq(affiliateWithdrawals.id, id)).for("update");
      if (!row) throw new HttpError(404, "درخواست برداشت پیدا نشد");
      if (row.status !== "pending") throw new HttpError(409, "درخواست قبلاً بررسی شده است");
      if (action === "paid" && await affiliateAvailableBalance(tx, row.affiliateUserId) < 0) throw new HttpError(409, "موجودی قابل تسویه به‌دلیل برگشت سفارش کافی نیست");
      const [updated] = await tx.update(affiliateWithdrawals).set({ status: action === "paid" ? "paid" : "rejected", adminNote: note || null, paymentReference: action === "paid" ? paymentReference : null, processedAt: new Date() }).where(eq(affiliateWithdrawals.id, id)).returning();
      if (action === "paid") await postJournal(tx, `تسویه پورسانت همکار فروش ${row.affiliateUserId}`, [
        { code: "2105", debit: row.amount, detail1: `affiliate:${row.affiliateUserId}`, description: `تسویه درخواست #${row.id}` },
        { code: "1101", credit: row.amount, description: `پرداخت ${paymentReference}` },
      ], { type: "affiliate_withdrawal", id: row.id }, u.id);
      await audit(tx, { userId: u.id, ...meta }, "affiliate.withdrawal_process", "affiliate_withdrawal", id, row, updated);
      return updated;
    });
  } },
];
