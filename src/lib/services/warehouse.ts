import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { orderHistory, orderItems, orders, products, sellers, sellerShipments, warehouseIssues } from "@/db/schema";
import { audit } from "../audit";
import { getSettings } from "../settings";
import { HttpError, genNumber } from "../util";
import type { Ctx } from "../types";

export type IssueScope = { staff: boolean; sellerId: number | null };

export const ISSUE_STATUS: Record<string, string> = { issued: "صادرشده — در انتظار تحویل", delivered: "تحویل مأمور ارسال شد", cancelled: "ابطال‌شده" };

function assertScope(sh: typeof sellerShipments.$inferSelect, scope: IssueScope) {
  if (scope.staff) { if (sh.sellerId !== null) throw new HttpError(403, "حواله خروج مرسوله فروشنده توسط خود فروشنده صادر می‌شود"); return; }
  if (!scope.sellerId || sh.sellerId !== scope.sellerId) throw new HttpError(404, "مرسوله یافت نشد");
}

/** Issues an official warehouse exit slip for a shipment (one active slip per shipment). */
export async function createIssue(ctx: Ctx & { userId: number }, shipmentId: number, input: { notes?: string; carrier?: string; packageCount?: number }, scope: IssueScope) {
  return db.transaction(async (tx) => {
    const [sh] = await tx.select().from(sellerShipments).where(eq(sellerShipments.id, shipmentId)).for("update");
    if (!sh) throw new HttpError(404, "مرسوله یافت نشد");
    assertScope(sh, scope);
    const [o] = await tx.select().from(orders).where(eq(orders.id, sh.orderId));
    if (o.paymentStatus !== "paid") throw new HttpError(400, "سفارش پرداخت نشده است؛ صدور حواله خروج مجاز نیست");
    if (!["pending", "preparing", "ready", "shipped"].includes(sh.status)) throw new HttpError(400, "برای این وضعیت مرسوله حواله خروج صادر نمی‌شود");
    const [active] = await tx.select().from(warehouseIssues).where(and(eq(warehouseIssues.shipmentId, sh.id), ne(warehouseIssues.status, "cancelled")));
    if (active) throw new HttpError(409, `حواله خروج ${active.number} قبلاً برای این مرسوله صادر شده است`);
    const rows = await tx.select({ i: orderItems, sku: products.sku, pn: products.partNumber }).from(orderItems).innerJoin(products, eq(products.id, orderItems.productId)).where(eq(orderItems.shipmentId, sh.id));
    if (!rows.length) throw new HttpError(400, "مرسوله قلمی ندارد");
    const s = await getSettings(tx);
    const [seller] = sh.sellerId ? await tx.select().from(sellers).where(eq(sellers.id, sh.sellerId)) : [];
    const [iss] = await tx.insert(warehouseIssues).values({
      number: genNumber("WH"), shipmentId: sh.id, orderId: o.id, sellerId: sh.sellerId, status: "issued",
      items: rows.map(({ i, sku, pn }) => ({ title: i.title, sku, partNumber: pn, qty: i.qty })),
      packageCount: Math.max(1, Math.min(50, input.packageCount ?? sh.packageCount)), carrier: input.carrier || sh.carrier,
      warehouseName: seller ? `انبار ${seller.shopName} — ${seller.city}` : s.senderName, notes: input.notes || null, issuedBy: ctx.userId,
    }).returning();
    await tx.insert(orderHistory).values({ orderId: o.id, status: "warehouse_issue", note: `صدور حواله خروج از انبار ${iss.number} برای مرسوله #${sh.id}`, userId: ctx.userId });
    await audit(tx, ctx, "warehouse_issue.create", "warehouse_issue", iss.id, null, { number: iss.number, shipmentId: sh.id, items: iss.items.length });
    return iss;
  });
}

/** Records handover of goods to the courier / dispatcher (receiver identity is captured on the slip). */
export async function handoverIssue(ctx: Ctx & { userId: number }, issueId: number, input: { receiverName: string; receiverPhone?: string; receiverNationalId?: string; receiverRole?: string }, scope: IssueScope) {
  return db.transaction(async (tx) => {
    const [iss] = await tx.select().from(warehouseIssues).where(eq(warehouseIssues.id, issueId)).for("update");
    if (!iss) throw new HttpError(404, "حواله یافت نشد");
    if (!scope.staff && iss.sellerId !== scope.sellerId) throw new HttpError(404, "حواله یافت نشد");
    if (scope.staff && iss.sellerId !== null) throw new HttpError(403, "حواله فروشنده توسط خود فروشنده تحویل می‌شود");
    if (iss.status !== "issued") throw new HttpError(400, "این حواله در وضعیت تحویل نیست");
    if (!input.receiverName) throw new HttpError(400, "نام تحویل‌گیرنده الزامی است");
    if (input.receiverNationalId && !/^\d{10}$/.test(input.receiverNationalId)) throw new HttpError(400, "کد ملی باید ۱۰ رقم باشد");
    await tx.update(warehouseIssues).set({ status: "delivered", receiverName: input.receiverName, receiverPhone: input.receiverPhone || null, receiverNationalId: input.receiverNationalId || null, receiverRole: input.receiverRole || null, handedOverBy: ctx.userId, handedOverAt: new Date() }).where(eq(warehouseIssues.id, iss.id));
    await tx.insert(orderHistory).values({ orderId: iss.orderId, status: "warehouse_handover", note: `تحویل کالا طبق حواله ${iss.number} به ${input.receiverName}${input.receiverRole ? ` (${input.receiverRole})` : ""}`, userId: ctx.userId });
    await audit(tx, ctx, "warehouse_issue.handover", "warehouse_issue", iss.id, { status: iss.status }, { status: "delivered", receiver: input.receiverName, nationalId: input.receiverNationalId ? `***${input.receiverNationalId.slice(-3)}` : null });
  });
}

export async function cancelIssue(ctx: Ctx & { userId: number }, issueId: number, reason: string, scope: IssueScope) {
  return db.transaction(async (tx) => {
    const [iss] = await tx.select().from(warehouseIssues).where(eq(warehouseIssues.id, issueId)).for("update");
    if (!iss || (!scope.staff && iss.sellerId !== scope.sellerId) || (scope.staff && iss.sellerId !== null)) throw new HttpError(404, "حواله یافت نشد");
    if (iss.status !== "issued") throw new HttpError(400, "فقط حواله تحویل‌نشده قابل ابطال است");
    await tx.update(warehouseIssues).set({ status: "cancelled", cancelReason: reason || "ابطال" }).where(eq(warehouseIssues.id, iss.id));
    await tx.insert(orderHistory).values({ orderId: iss.orderId, status: "warehouse_issue_cancel", note: `ابطال حواله خروج ${iss.number}: ${reason}`, userId: ctx.userId });
    await audit(tx, ctx, "warehouse_issue.cancel", "warehouse_issue", iss.id, { status: iss.status }, { status: "cancelled", reason });
  });
}
