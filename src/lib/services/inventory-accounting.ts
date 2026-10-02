import { asc, eq, sql } from "drizzle-orm";
import { detailAccounts, inventoryConsignmentLots, inventoryConsignmentUsages, inventoryParties } from "@/db/schema";
import { postJournal } from "../accounting";
import type { DB } from "../types";
import { HttpError } from "../util";

export async function ensureInventoryPartyDetail(tx: DB, partyId: number) {
  const [party] = await tx.select().from(inventoryParties).where(eq(inventoryParties.id, partyId)).for("update");
  if (!party || !party.enabled) throw new HttpError(400, "تولیدکننده یا صاحب کالا معتبر/فعال نیست");
  if (party.detailAccountId) {
    const [detail] = await tx.select().from(detailAccounts).where(eq(detailAccounts.id, party.detailAccountId));
    if (detail) return detail;
  }
  let [root] = await tx.select().from(detailAccounts).where(eq(detailAccounts.code, "1"));
  if (!root) [root] = await tx.insert(detailAccounts).values({ code: "1", name: "اشخاص", level: 1, parentId: null }).returning();
  const [detail] = await tx.insert(detailAccounts).values({ code: `IP-${party.id}`, name: party.name, level: 2, parentId: root.id }).returning();
  await tx.update(inventoryParties).set({ detailAccountId: detail.id }).where(eq(inventoryParties.id, party.id));
  return detail;
}

export type ConsignmentChunk = { receiptId: number; partyId: number; quantity: number; unitCost: number };

/** Consume owner-specific stock first (oldest receipt first), returning the exact payable cost by producer. */
export async function consumeConsignmentLots(tx: DB, productId: number, variantId: number | null, quantity: number, usage?: { action: string; refType: string; refId: number }): Promise<ConsignmentChunk[]> {
  if (quantity <= 0) return [];
  const rows = await tx.select().from(inventoryConsignmentLots)
    .where(variantId === null
      ? sql`${inventoryConsignmentLots.productId} = ${productId} and ${inventoryConsignmentLots.variantId} is null and ${inventoryConsignmentLots.remainingQty} > 0`
      : sql`${inventoryConsignmentLots.productId} = ${productId} and ${inventoryConsignmentLots.variantId} = ${variantId} and ${inventoryConsignmentLots.remainingQty} > 0`)
    .orderBy(asc(inventoryConsignmentLots.createdAt), asc(inventoryConsignmentLots.id)).for("update");
  let remaining = quantity;
  const out: ConsignmentChunk[] = [];
  for (const lot of rows) {
    if (!remaining) break;
    const used = Math.min(lot.remainingQty, remaining);
    await tx.update(inventoryConsignmentLots).set({ remainingQty: sql`${inventoryConsignmentLots.remainingQty} - ${used}` }).where(eq(inventoryConsignmentLots.id, lot.id));
    if (usage) await tx.insert(inventoryConsignmentUsages).values({ lotId: lot.id, receiptId: lot.receiptId, partyId: lot.partyId, productId, variantId: lot.variantId, quantity: used, unitCost: lot.unitCost, action: usage.action, refType: usage.refType, refId: usage.refId });
    out.push({ receiptId: lot.receiptId, partyId: lot.partyId, quantity: used, unitCost: lot.unitCost });
    remaining -= used;
  }
  return out;
}

export async function restoreConsignmentSale(tx: DB, refType: string, refId: number) {
  const usages = await tx.select().from(inventoryConsignmentUsages).where(sql`${inventoryConsignmentUsages.refType} = ${refType} and ${inventoryConsignmentUsages.refId} = ${refId} and ${inventoryConsignmentUsages.action} = 'sale' and not ${inventoryConsignmentUsages.reversed}`).for("update");
  for (const usage of usages) {
    await tx.update(inventoryConsignmentLots).set({ remainingQty: sql`${inventoryConsignmentLots.remainingQty} + ${usage.quantity}` }).where(eq(inventoryConsignmentLots.id, usage.lotId));
    await tx.update(inventoryConsignmentUsages).set({ reversed: true }).where(eq(inventoryConsignmentUsages.id, usage.id));
  }
}

export async function transferConsignmentLots(tx: DB, productId: number, targetVariantId: number | null, chunks: ConsignmentChunk[], outputQty: number, sourceBaseQty: number) {
  if (!chunks.length || outputQty <= 0 || sourceBaseQty <= 0) return;
  const consignedQty = chunks.reduce((sum, item) => sum + item.quantity, 0);
  const consignedOutput = Math.min(outputQty, Math.round(outputQty * consignedQty / sourceBaseQty));
  const allocations = chunks.map((chunk) => ({ ...chunk, outputQty: Math.floor(consignedOutput * chunk.quantity / consignedQty) }));
  let allocated = allocations.reduce((sum, x) => sum + x.outputQty, 0);
  for (let i = 0; allocated < consignedOutput; i = (i + 1) % allocations.length, allocated++) allocations[i].outputQty++;
  for (const item of allocations) {
    if (!item.outputQty) continue;
    await tx.insert(inventoryConsignmentLots).values({ receiptId: item.receiptId, partyId: item.partyId, productId, variantId: targetVariantId, initialQty: item.outputQty, remainingQty: item.outputQty, unitCost: Math.round(item.quantity * item.unitCost / item.outputQty) });
  }
}

export async function postConsignmentPayables(tx: DB, chunks: ConsignmentChunk[], description: string, ref: { type: string; id: number }, userId?: number | null) {
  const sums = new Map<number, number>();
  for (const chunk of chunks) sums.set(chunk.partyId, (sums.get(chunk.partyId) ?? 0) + chunk.quantity * chunk.unitCost);
  const lines = [];
  for (const [partyId, amount] of sums) {
    if (!amount) continue;
    const detail = await ensureInventoryPartyDetail(tx, partyId);
    lines.push({ code: "5101", debit: amount, description: "بهای کالای امانی فروخته‌شده" });
    lines.push({ code: "2104", credit: amount, detail1Id: detail.id, description: `تسویه کالای امانی ${detail.name}` });
  }
  if (lines.length) await postJournal(tx, description, lines, ref, userId);
}
