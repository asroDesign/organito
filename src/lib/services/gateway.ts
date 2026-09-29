import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, supplyRequests, users } from "@/db/schema";
import { audit, notify } from "../audit";
import { HttpError } from "../util";
import { zpMode, zpRequest, zpVerify } from "../zarinpal";
import { payOrder } from "./orders";
import { customerSupplyAction } from "./supply";
import type { Ctx } from "../types";

export type GatewayTarget = { orderId: number } | { supplyId: number };

/** Step 1: create an "initiated" payment row and a Zarinpal authority; returns the StartPay URL. */
export async function startGatewayPayment(ctx: Ctx & { userId: number }, target: GatewayTarget, baseUrl: string) {
  const [u] = await db.select().from(users).where(eq(users.id, ctx.userId));
  let amount = 0, description = "", ref: { orderId?: number; supplyRequestId?: number } = {}, number = "";
  if ("orderId" in target) {
    const [o] = await db.select().from(orders).where(eq(orders.id, target.orderId));
    if (!o || o.customerId !== ctx.userId) throw new HttpError(404, "سفارش یافت نشد");
    if (o.status !== "pending_payment") throw new HttpError(400, "این سفارش در وضعیت پرداخت نیست");
    if (o.paymentStatus === "pending_verification") throw new HttpError(400, "فیش پرداخت این سفارش در انتظار تأیید است");
    amount = o.total; description = `پرداخت سفارش ${o.number} - سبزینه`; ref = { orderId: o.id }; number = o.number;
  } else {
    const [r] = await db.select().from(supplyRequests).where(eq(supplyRequests.id, target.supplyId));
    if (!r || r.customerId !== ctx.userId) throw new HttpError(404, "درخواست یافت نشد");
    if (r.status !== "payment_pending") throw new HttpError(400, "درخواست در وضعیت پرداخت نیست");
    amount = r.quotationTotal; description = `پیش‌فاکتور تأمین ${r.number} - سبزینه`; ref = { supplyRequestId: r.id }; number = r.number;
  }
  if (amount < 1000) throw new HttpError(400, "حداقل مبلغ پرداخت اینترنتی ۱۰۰۰ تومان است");
  // expire previous unfinished attempts
  const cond = ref.orderId ? eq(payments.orderId, ref.orderId) : eq(payments.supplyRequestId, ref.supplyRequestId!);
  await db.update(payments).set({ status: "expired" }).where(and(cond, eq(payments.status, "initiated")));
  const mode = zpMode();
  const [pay] = await db.insert(payments).values({
    ...ref, amount, method: "gateway", status: "initiated", gateway: mode === "simulator" ? "zarinpal-simulator" : mode === "sandbox" ? "zarinpal-sandbox" : "zarinpal",
    ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, recordedBy: ctx.userId, idempotencyKey: `zp:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    details: { number },
  }).returning();
  try {
    const r = await zpRequest({ amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/zarinpal/callback`, description, mobile: u?.phone, email: u?.email ?? undefined, orderId: number });
    await db.update(payments).set({ authority: r.authority }).where(eq(payments.id, pay.id));
    await audit(db, ctx, "payment.gateway_start", ref.orderId ? "order" : "supply_request", ref.orderId ?? ref.supplyRequestId!, null, { paymentId: pay.id, amount, mode });
    return { url: r.payUrl.startsWith("/") ? `${baseUrl}${r.payUrl}` : r.payUrl, paymentId: pay.id, mode };
  } catch (e) {
    await db.update(payments).set({ status: "failed", note: (e as Error).message.slice(0, 300) }).where(eq(payments.id, pay.id));
    throw new HttpError(502, (e as Error).message || "اتصال به درگاه برقرار نشد");
  }
}

/** Step 2: callback. Verifies with Zarinpal (amount taken from DB) and settles the order/supply. Safe to call repeatedly. */
export async function handleGatewayCallback(authority: string, status: string, simulatedOk: boolean, meta: { ip?: string | null; ua?: string | null }) {
  const [pay] = await db.select().from(payments).where(and(eq(payments.authority, authority), eq(payments.method, "gateway")));
  if (!pay) return { ok: false, paymentId: null, message: "تراکنش یافت نشد" };
  if (pay.status === "success") return { ok: true, paymentId: pay.id, message: "پرداخت قبلاً تأیید شده است" };
  if (!["initiated"].includes(pay.status)) return { ok: false, paymentId: pay.id, message: pay.status === "needs_refund" ? "پرداخت انجام شد ولی سفارش قابل تأیید نبود؛ مبلغ مسترد می‌شود" : "این تراکنش معتبر نیست یا منقضی شده است" };
  const ownerId = pay.recordedBy!;
  const ctx = { userId: ownerId, ip: meta.ip, ua: meta.ua };
  if (status !== "OK") {
    await db.update(payments).set({ status: "cancelled", note: "انصراف کاربر یا تراکنش ناموفق در درگاه" }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated")));
    await audit(db, ctx, "payment.gateway_cancel", "payment", pay.id, null, { status });
    return { ok: false, paymentId: pay.id, message: "پرداخت توسط شما لغو شد یا ناموفق بود" };
  }
  let v;
  try {
    v = await zpVerify(authority, pay.amount * 10, zpMode() === "simulator" ? simulatedOk : undefined);
  } catch (e) {
    return { ok: false, paymentId: pay.id, message: `خطا در تأیید تراکنش: ${(e as Error).message}. در صورت کسر وجه، ظرف ۷۲ ساعت بازمی‌گردد یا با پشتیبانی تماس بگیرید.` };
  }
  if (!v.ok) {
    await db.update(payments).set({ status: "failed", note: v.message, details: { ...pay.details, verifyCode: String(v.code) } }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated")));
    await audit(db, ctx, "payment.gateway_failed", "payment", pay.id, null, { code: v.code });
    return { ok: false, paymentId: pay.id, message: v.message };
  }
  const card = v.cardPan ? v.cardPan.replace(/^(\d{4})(\d{2})\**(\d{4})$/, "$1-$2**-****-$3") : null;
  await db.update(payments).set({
    refCode: v.refId || pay.refCode, cardMasked: card, paidAt: new Date(),
    details: { ...pay.details, verifyCode: String(v.code), ...(v.cardHash ? { cardHash: v.cardHash.slice(0, 16) + "…" } : {}), ...(v.fee !== undefined ? { fee: String(v.fee), feeType: v.feeType ?? "" } : {}) },
  }).where(eq(payments.id, pay.id));
  try {
    if (pay.orderId) await payOrder(ctx, pay.orderId, `zpv:${pay.id}`, false, { method: "gateway", existingPaymentId: pay.id });
    else if (pay.supplyRequestId) await customerSupplyAction(ctx, pay.supplyRequestId, "pay", `zpv:${pay.id}`, pay.id);
    await audit(db, ctx, "payment.gateway_success", "payment", pay.id, null, { refId: v.refId, amount: pay.amount });
    return { ok: true, paymentId: pay.id, message: "پرداخت با موفقیت انجام شد", refId: v.refId };
  } catch (e) {
    // money captured but order can't be settled (e.g. cancelled meanwhile) → flag for refund
    const [again] = await db.select().from(payments).where(eq(payments.id, pay.id));
    if (again.status === "success") return { ok: true, paymentId: pay.id, message: "پرداخت با موفقیت انجام شد", refId: v.refId };
    await db.update(payments).set({ status: "needs_refund", note: `پرداخت موفق ولی ثبت نشد: ${(e as Error).message}` }).where(eq(payments.id, pay.id));
    const admins = await db.select({ id: users.id }).from(users).where(inArray(users.role, ["super_admin", "accountant"]));
    for (const a of admins) await notify(db, a.id, "پرداخت نیازمند استرداد", `پرداخت #${pay.id} (${v.refId}) موفق بود اما سفارش قابل تأیید نبود.`, pay.orderId ? `/orders/${pay.orderId}` : undefined);
    await audit(db, ctx, "payment.needs_refund", "payment", pay.id, null, { error: (e as Error).message });
    return { ok: false, paymentId: pay.id, message: "وجه دریافت شد اما سفارش قابل تأیید نبود (مثلاً لغو شده). مبلغ توسط واحد مالی مسترد می‌شود." };
  }
}
