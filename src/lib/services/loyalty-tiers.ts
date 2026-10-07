import { and, eq, sql } from "drizzle-orm";
import { centralLoyaltyMembers, centralPosSales, loyaltyTierHistory, orders, users } from "@/db/schema";
import { getSettings } from "../settings";
import type { DB } from "../types";

export type LoyaltyTierRule = { code: "bronze" | "silver" | "gold"; name: string; minimumSpend: number; pointsMultiplierBps: number };
export const DEFAULT_LOYALTY_TIERS: LoyaltyTierRule[] = [
  { code: "bronze", name: "برنزی", minimumSpend: 0, pointsMultiplierBps: 10000 },
  { code: "silver", name: "نقره‌ای", minimumSpend: 5_000_000, pointsMultiplierBps: 12500 },
  { code: "gold", name: "طلایی", minimumSpend: 20_000_000, pointsMultiplierBps: 15000 },
];

export function normalizeLoyaltyTiers(value: unknown): LoyaltyTierRule[] {
  if (!Array.isArray(value)) return DEFAULT_LOYALTY_TIERS;
  const byCode = new Map(value.map((item) => [String((item as Record<string, unknown>)?.code), item as Record<string, unknown>]));
  const tiers = DEFAULT_LOYALTY_TIERS.map((fallback) => {
    const row = byCode.get(fallback.code);
    if (!row) return fallback;
    const minimumSpend = Number(row.minimumSpend), pointsMultiplier = Number(row.pointsMultiplierBps);
    return {
      code: fallback.code,
      name: String(row.name ?? fallback.name).trim().slice(0, 32) || fallback.name,
      minimumSpend: Number.isSafeInteger(minimumSpend) && minimumSpend >= 0 ? minimumSpend : fallback.minimumSpend,
      pointsMultiplierBps: Number.isInteger(pointsMultiplier) && pointsMultiplier >= 10000 && pointsMultiplier <= 50000 ? pointsMultiplier : fallback.pointsMultiplierBps,
    };
  });
  tiers[0].minimumSpend = 0;
  tiers[1].minimumSpend = Math.max(tiers[0].minimumSpend, tiers[1].minimumSpend);
  tiers[2].minimumSpend = Math.max(tiers[1].minimumSpend, tiers[2].minimumSpend);
  return tiers;
}

export function tierForSpend(spend: number, rules: LoyaltyTierRule[], enabled: boolean) {
  const safeSpend = Math.max(0, Number(spend) || 0);
  const tiers = normalizeLoyaltyTiers(rules);
  const current = enabled ? [...tiers].reverse().find((tier) => safeSpend >= tier.minimumSpend)! : tiers[0];
  const index = tiers.findIndex((tier) => tier.code === current.code);
  const next = enabled ? tiers[index + 1] ?? null : null;
  return { ...current, enabled, lifetimeSpent: safeSpend, nextTier: next, progress: next ? Math.min(100, Math.floor(((safeSpend - current.minimumSpend) / Math.max(1, next.minimumSpend - current.minimumSpend)) * 100)) : 100 };
}

export async function loyaltyProgram(tx: DB) {
  const cfg = await getSettings(tx);
  return { enabled: Number(cfg.loyaltyTiersEnabled) === 1, tiers: normalizeLoyaltyTiers(cfg.loyaltyTierRules) };
}

export async function customerLifetimeSpend(tx: DB, userId?: number | null, phoneHint?: string | null) {
  let phone = phoneHint?.trim() ?? "";
  if (userId && !phone) {
    const [user] = await tx.select({ phone: users.phone }).from(users).where(eq(users.id, userId));
    phone = user?.phone ?? "";
  }
  if (!phone) return 0;
  const [[online], [inPerson]] = await Promise.all([
    tx.select({ amount: sql<number>`coalesce(sum(${orders.total}),0)::bigint` }).from(orders).innerJoin(users, eq(users.id, orders.customerId)).where(and(eq(users.phone, phone), eq(orders.paymentStatus, "paid"))),
    tx.select({ amount: sql<number>`coalesce(sum(${centralPosSales.total}),0)::bigint` }).from(centralPosSales).where(and(eq(centralPosSales.customerPhone, phone), eq(centralPosSales.status, "completed"))),
  ]);
  return Number(online?.amount ?? 0) + Number(inPerson?.amount ?? 0);
}

export async function customerLoyaltyTier(tx: DB, userId?: number | null, phoneHint?: string | null) {
  const [{ enabled, tiers }, lifetimeSpent] = await Promise.all([loyaltyProgram(tx), customerLifetimeSpend(tx, userId, phoneHint)]);
  return tierForSpend(lifetimeSpent, tiers, enabled);
}

export async function syncCustomerLoyaltyTier(tx: DB, options: { userId?: number | null; phone: string; reason: string; refType: string; refId: number }) {
  const phone = options.phone.trim();
  if (!phone) return null;
  const [tier] = await Promise.all([customerLoyaltyTier(tx, options.userId, phone)]);
  const [[user], [member]] = await Promise.all([
    tx.select({ id: users.id, loyaltyTier: users.loyaltyTier }).from(users).where(options.userId ? eq(users.id, options.userId) : eq(users.phone, phone)),
    tx.select({ id: centralLoyaltyMembers.id, loyaltyTier: centralLoyaltyMembers.loyaltyTier }).from(centralLoyaltyMembers).where(eq(centralLoyaltyMembers.phone, phone)),
  ]);
  const previous = user?.loyaltyTier ?? member?.loyaltyTier ?? "bronze";
  if (user && user.loyaltyTier !== tier.code) await tx.update(users).set({ loyaltyTier: tier.code }).where(eq(users.id, user.id));
  if (member && member.loyaltyTier !== tier.code) await tx.update(centralLoyaltyMembers).set({ loyaltyTier: tier.code, updatedAt: new Date() }).where(eq(centralLoyaltyMembers.id, member.id));
  if (previous !== tier.code) await tx.insert(loyaltyTierHistory).values({ userId: user?.id ?? options.userId ?? null, phone, fromTier: previous, toTier: tier.code, lifetimeSpent: tier.lifetimeSpent, reason: options.reason, refType: options.refType, refId: options.refId }).onConflictDoNothing();
  return tier;
}
