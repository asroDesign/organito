import { and, eq, inArray, sql } from "drizzle-orm";
import { affiliateEarnings, affiliateProductRules, affiliateProfiles, affiliateProgramSettings, affiliateWithdrawals, journalEntries, orderItems, orders } from "@/db/schema";
import { postJournal, reverseJournal } from "../accounting";
import type { DB } from "../types";

export async function recordAffiliateEarnings(tx: DB, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order?.affiliateUserId || order.paymentStatus === "refunded") return 0;
  const [[profile], [config], items] = await Promise.all([
    tx.select().from(affiliateProfiles).where(and(eq(affiliateProfiles.userId, order.affiliateUserId), eq(affiliateProfiles.status, "active"))),
    tx.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1)),
    tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
  ]);
  if (!profile || !config?.enabled || !items.length) return 0;
  const rules = await tx.select().from(affiliateProductRules).where(and(inArray(affiliateProductRules.productId, items.map((item) => item.productId)), eq(affiliateProductRules.enabled, true)));
  const byProduct = new Map(rules.map((rule) => [rule.productId, rule]));
  const rateKey = profile.tier === "gold" ? "goldRateBps" : profile.tier === "silver" ? "silverRateBps" : "bronzeRateBps";
  const subtotal = Math.max(0, Number(order.itemsSubtotal ?? 0));
  if (!subtotal) return 0;
  const payableItems = Math.max(0, subtotal - Number(order.discount ?? 0));
  const insertedIds: number[] = [];
  let totalCommission = 0;
  for (const item of items) {
    const rule = byProduct.get(item.productId);
    if (!rule) continue;
    const rawRate = rule[rateKey] ?? config[rateKey];
    const rateBps = Math.max(0, Math.min(10000, Math.round(Number(rawRate) || 0)));
    const baseAmount = Math.max(0, Math.round(Number(item.lineTotal ?? 0) * payableItems / subtotal));
    const amount = Math.round(baseAmount * rateBps / 10000);
    if (!amount || !rateBps) continue;
    const [created] = await tx.insert(affiliateEarnings).values({ affiliateUserId: profile.userId, orderId: order.id, orderItemId: item.id, productId: item.productId, baseAmount, amount, rateBps, tier: profile.tier, status: "pending" }).onConflictDoNothing().returning({ id: affiliateEarnings.id });
    if (created) { insertedIds.push(created.id); totalCommission += amount; }
  }
  if (insertedIds.length) {
    const entry = await postJournal(tx, `پورسانت همکاری در فروش سفارش ${order.number}`, [
      { code: "5302", debit: totalCommission, description: `پورسانت سفارش ${order.number}` },
      { code: "2105", credit: totalCommission, detail1: `affiliate:${profile.userId}`, description: `بدهی پورسانت سفارش ${order.number}` },
    ], { type: "affiliate_commission", id: order.id });
    if (entry) await tx.update(affiliateEarnings).set({ journalEntryId: entry.id }).where(inArray(affiliateEarnings.id, insertedIds));
  }
  return insertedIds.length;
}

export async function releaseAffiliateEarnings(tx: DB, orderId: number) {
  await tx.update(affiliateEarnings).set({ status: "available", availableAt: new Date() }).where(and(eq(affiliateEarnings.orderId, orderId), eq(affiliateEarnings.status, "pending")));
}

/** Void unsettled commissions; reverse released commissions with an auditable negative ledger entry. */
export async function reverseAffiliateEarnings(tx: DB, orderId: number, userId?: number | null, returnId?: number) {
  const rows = await tx.select().from(affiliateEarnings).where(and(eq(affiliateEarnings.orderId, orderId), inArray(affiliateEarnings.status, ["pending", "available"])));
  const journalIds = [...new Set(rows.filter((row) => row.journalEntryId).map((row) => row.journalEntryId!))];
  for (const journalId of journalIds) {
    const [entry] = await tx.select().from(journalEntries).where(eq(journalEntries.id, journalId));
    if (entry && entry.status !== "reversed") await reverseJournal(tx, journalId, "برگشت سفارش دارای پورسانت همکاری در فروش", userId, { type: "affiliate_commission_reversal", id: returnId ?? orderId });
  }
  for (const row of rows) {
    if (row.status === "pending") {
      await tx.update(affiliateEarnings).set({ status: "void" }).where(eq(affiliateEarnings.id, row.id));
      continue;
    }
    await tx.update(affiliateEarnings).set({ status: "reversed" }).where(eq(affiliateEarnings.id, row.id));
    await tx.insert(affiliateEarnings).values({ affiliateUserId: row.affiliateUserId, orderId: row.orderId, orderItemId: null, reversesEarningId: row.id, productId: row.productId, baseAmount: -row.baseAmount, amount: -row.amount, rateBps: row.rateBps, tier: row.tier, status: "available", availableAt: new Date() }).onConflictDoNothing();
  }
}

export async function affiliateAvailableBalance(tx: DB, affiliateUserId: number) {
  const [[earned], [withdrawn]] = await Promise.all([
    tx.select({ amount: sql<number>`coalesce(sum(${affiliateEarnings.amount}),0)` }).from(affiliateEarnings).where(and(eq(affiliateEarnings.affiliateUserId, affiliateUserId), eq(affiliateEarnings.status, "available"))),
    tx.select({ amount: sql<number>`coalesce(sum(${affiliateWithdrawals.amount}),0)` }).from(affiliateWithdrawals).where(and(eq(affiliateWithdrawals.affiliateUserId, affiliateUserId), inArray(affiliateWithdrawals.status, ["pending", "paid"]))),
  ]);
  return Number(earned?.amount ?? 0) - Number(withdrawn?.amount ?? 0);
}
