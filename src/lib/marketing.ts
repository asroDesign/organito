import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { carrierRates, carriers, discountCodes, discountUsages, festivals } from "@/db/schema";
import type { DB } from "./types";

export type Festival = typeof festivals.$inferSelect;
export type Carrier = typeof carriers.$inferSelect;

export async function activeFestivals(tx: DB = db): Promise<Festival[]> {
  const now = new Date();
  return tx.select().from(festivals).where(and(eq(festivals.isActive, true), lte(festivals.startsAt, now), gte(festivals.endsAt, now))).orderBy(asc(festivals.endsAt));
}

/** Best festival for a product (all-products festivals have empty product & category lists). */
export function festivalFor(fs: Festival[], productId: number, categoryId: number | null): Festival | null {
  let best: Festival | null = null;
  for (const f of fs) {
    const all = f.productIds.length === 0 && f.categoryIds.length === 0;
    const ok = all || f.productIds.includes(productId) || (categoryId !== null && f.categoryIds.includes(categoryId));
    if (ok && (!best || f.discountPercent > best.discountPercent)) best = f;
  }
  return best;
}
export const applyPct = (price: number, pct: number) => price - Math.round((price * pct) / 100);

export async function activeCarriers(tx: DB = db) {
  return tx.select().from(carriers).where(eq(carriers.isActive, true)).orderBy(asc(carriers.sortOrder), asc(carriers.id));
}

/** Shipping cost for a carrier by destination city and weight (grams). City-specific rate > generic rate > base + per-kg formula. */
export async function carrierCost(tx: DB, c: Carrier, city: string, weight: number, itemsTotal: number) {
  if (c.freeThreshold > 0 && itemsTotal >= c.freeThreshold) return 0;
  const rates = await tx.select().from(carrierRates).where(eq(carrierRates.carrierId, c.id));
  const inRange = rates.filter((r) => weight >= r.minWeight && weight <= r.maxWeight);
  const norm = (s: string | null) => (s ?? "").trim().replace(/ي/g, "ی").replace(/ك/g, "ک");
  const cityRate = inRange.find((r) => r.city && norm(r.city) === norm(city));
  const generic = inRange.find((r) => !r.city);
  const r = cityRate ?? generic;
  if (r) return r.cost;
  return c.baseCost + c.perKgCost * Math.max(0, Math.ceil(weight / 1000) - 1);
}

export type DiscountLine = { productId: number; categoryId: number | null; amount: number };
export type DiscountResult = { ok: boolean; error?: string; codeId?: number; code?: string; title?: string; amount: number };

export async function evaluateCode(tx: DB, rawCode: string, userId: number | null, lines: DiscountLine[], lock = false): Promise<DiscountResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, amount: 0 };
  const q = tx.select().from(discountCodes).where(eq(discountCodes.code, code));
  const [d] = lock ? await q.for("update") : await q;
  const fail = (error: string): DiscountResult => ({ ok: false, error, amount: 0, code });
  if (!d || !d.isActive) return fail("کد تخفیف نامعتبر است");
  const now = new Date();
  if (d.startsAt && d.startsAt > now) return fail("زمان استفاده از این کد هنوز فرا نرسیده");
  if (d.endsAt && d.endsAt < now) return fail("این کد تخفیف منقضی شده است");
  if (d.usageLimit !== null && d.usedCount >= d.usageLimit) return fail("ظرفیت استفاده از این کد تمام شده است");
  if (d.customerId) {
    if (!userId) return fail("برای استفاده از این کد وارد حساب شوید");
    if (d.customerId !== userId) return fail("این کد مخصوص مشتری دیگری است");
  }
  if (userId && d.perUserLimit > 0) {
    const used = await tx.select({ id: discountUsages.id }).from(discountUsages).where(and(eq(discountUsages.codeId, d.id), eq(discountUsages.userId, userId)));
    if (used.length >= d.perUserLimit) return fail("سقف استفاده شما از این کد پر شده است");
  }
  const restricted = d.productIds.length > 0 || d.categoryIds.length > 0;
  const eligible = lines.filter((l) => !restricted || d.productIds.includes(l.productId) || (l.categoryId !== null && d.categoryIds.includes(l.categoryId)));
  const base = eligible.reduce((a, l) => a + l.amount, 0);
  if (!base) return fail("این کد برای کالاهای سبد شما قابل استفاده نیست");
  const total = lines.reduce((a, l) => a + l.amount, 0);
  if (d.minOrder > 0 && total < d.minOrder) return fail(`حداقل مبلغ خرید برای این کد ${d.minOrder.toLocaleString("fa-IR")} تومان است`);
  let amount = d.type === "percent" ? Math.round((base * d.value) / 100) : d.value;
  if (d.type === "percent" && d.maxDiscount > 0) amount = Math.min(amount, d.maxDiscount);
  amount = Math.min(amount, base);
  return { ok: true, codeId: d.id, code, title: d.title, amount };
}
