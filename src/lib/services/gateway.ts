import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerWalletEntries, customerWallets, orders, payments, supplyRequests, users } from "@/db/schema";
import { audit, notify } from "../audit";
import { HttpError } from "../util";
import { zpMode, zpRequest, zpVerify } from "../zarinpal";
import { zibalMode, zibalRequest, zibalVerify } from "../zibal";
import { getSettings } from "../settings";
import { payOrder } from "./orders";
import { customerSupplyAction } from "./supply";
import type { Ctx } from "../types";

export type GatewayTarget = { orderId: number } | { supplyId: number } | { walletAmount: number };

/** Step 1: create an initiated payment and return the selected gateway URL. */
export async function startGatewayPayment(ctx: Ctx & { userId: number }, target: GatewayTarget, baseUrl: string) {
  const settings = await getSettings();
  const [u] = await db.select().from(users).where(eq(users.id, ctx.userId));
  let amount = 0, description = "", ref: { orderId?: number; supplyRequestId?: number } = {}, number = "";
  if ("orderId" in target) {
    const [o] = await db.select().from(orders).where(eq(orders.id, target.orderId));
    if (!o || o.customerId !== ctx.userId) throw new HttpError(404, "سفارش یافت نشد");
    if (o.status !== "pending_payment") throw new HttpError(400, "این سفارش در وضعیت پرداخت نیست");
    if (o.paymentStatus === "pending_verification") throw new HttpError(400, "فیش پرداخت این سفارش در انتظار تأیید است");
    amount = o.total; description = `پرداخت سفارش ${o.number} - ${settings.siteName}`; ref = { orderId: o.id }; number = o.number;
  } else if ("supplyId" in target) {
    const [r] = await db.select().from(supplyRequests).where(eq(supplyRequests.id, target.supplyId));
    if (!r || r.customerId !== ctx.userId) throw new HttpError(404, "درخواست یافت نشد");
    if (r.status !== "payment_pending") throw new HttpError(400, "درخواست در وضعیت پرداخت نیست");
    if (r.quotationExpiresAt && r.quotationExpiresAt <= new Date()) throw new HttpError(400, "مهلت پیش‌فاکتور تمام شده و پرداخت آن امکان‌پذیر نیست");
    amount = r.quotationTotal; description = `پیش‌فاکتور تأمین ${r.number} - ${settings.siteName}`; ref = { supplyRequestId: r.id }; number = r.number;
  } else {
    amount = target.walletAmount; description = `شارژ کیف پول مشتری - ${settings.siteName}`; number = `WALLET-${ctx.userId}`;
  }
  if (amount < 1000) throw new HttpError(400, "حداقل مبلغ پرداخت اینترنتی ۱۰۰۰ تومان است");
  // expire previous unfinished attempts
  const cond = ref.orderId ? eq(payments.orderId, ref.orderId) : ref.supplyRequestId ? eq(payments.supplyRequestId, ref.supplyRequestId) : null;
  if(cond)await db.update(payments).set({ status: "expired" }).where(and(cond, eq(payments.status, "initiated")));
  if (settings.paymentGateway !== "zibal" && settings.paymentGateway !== "zarinpal") throw new HttpError(503, "درگاه پرداخت تنظیم‌شده پشتیبانی نمی‌شود");
  const provider = settings.paymentGateway;
  const mode = provider === "zibal" ? zibalMode(settings.zibalMerchant) : zpMode();
  const [pay] = await db.insert(payments).values({
    ...ref, amount, method: "gateway", status: "initiated", gateway: provider === "zibal" ? (mode === "sandbox" ? "zibal-sandbox" : "zibal") : mode === "simulator" ? "zarinpal-simulator" : mode === "sandbox" ? "zarinpal-sandbox" : "zarinpal",
    ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, recordedBy: ctx.userId, idempotencyKey: `${provider === "zibal" ? "zi" : "zp"}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    details: { number, ...( "walletAmount" in target ? { walletTopup: "true" } : {}) },
  }).returning();
  try {
    const r = provider === "zibal"
      ? await zibalRequest({ amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/zibal/callback`, description, mobile: u?.phone, orderId: number, merchantId: settings.zibalMerchant })
      : await zpRequest({ amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/zarinpal/callback`, description, mobile: u?.phone, email: u?.email ?? undefined, orderId: number });
    await db.update(payments).set({ authority: r.authority }).where(eq(payments.id, pay.id));
    await audit(db, ctx, "payment.gateway_start", ref.orderId ? "order" : ref.supplyRequestId ? "supply_request" : "customer_wallet", ref.orderId ?? ref.supplyRequestId ?? ctx.userId, null, { paymentId: pay.id, amount, mode, provider });
    return { url: r.payUrl.startsWith("/") ? `${baseUrl}${r.payUrl}` : r.payUrl, paymentId: pay.id, mode, provider };
  } catch (e) {
    await db.update(payments).set({ status: "failed", note: (e as Error).message.slice(0, 300) }).where(eq(payments.id, pay.id));
    throw new HttpError(502, (e as Error).message || "اتصال به درگاه برقرار نشد");
  }
}

/** Step 2: verify with the original provider and settle the order/supply. Safe to call repeatedly. */
export async function handleGatewayCallback(authority: string, status: string, simulatedOk: boolean, meta: { ip?: string | null; ua?: string | null }, requestedProvider?: "zarinpal" | "zibal") {
  const [pay] = await db.select().from(payments).where(and(eq(payments.authority, authority), eq(payments.method, "gateway")));
  if (!pay) return { ok: false, paymentId: null, message: "تراکنش یافت نشد" };
  if (pay.status === "success") return { ok: true, paymentId: pay.id, message: "پرداخت قبلاً تأیید شده است" };
  if (!["initiated"].includes(pay.status)) return { ok: false, paymentId: pay.id, message: pay.status === "needs_refund" ? "پرداخت انجام شد ولی سفارش قابل تأیید نبود؛ مبلغ مسترد می‌شود" : "این تراکنش معتبر نیست یا منقضی شده است" };
  const ownerId = pay.recordedBy!;
  const ctx = { userId: ownerId, ip: meta.ip, ua: meta.ua };
  const provider = pay.gateway?.startsWith("zibal") ? "zibal" : "zarinpal";
  if (requestedProvider && requestedProvider !== provider) return { ok: false, paymentId: pay.id, message: "درگاه بازگشت با تراکنش مطابقت ندارد" };
  if ((provider === "zarinpal" && status !== "OK") || (provider === "zibal" && status !== "1")) {
    await db.update(payments).set({ status: "cancelled", note: "انصراف کاربر یا تراکنش ناموفق در درگاه" }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated")));
    await audit(db, ctx, "payment.gateway_cancel", "payment", pay.id, null, { status });
    return { ok: false, paymentId: pay.id, message: "پرداخت توسط شما لغو شد یا ناموفق بود" };
  }
  let v;
  try {
    const settings = await getSettings();
    v = provider === "zibal" ? await zibalVerify(authority, pay.amount * 10, settings.zibalMerchant) : await zpVerify(authority, pay.amount * 10, zpMode() === "simulator" ? simulatedOk : undefined);
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
  if(pay.details.walletTopup==="true"){
    await db.transaction(async tx=>{
      const [fresh]=await tx.select().from(payments).where(eq(payments.id,pay.id)).for("update");
      if(!fresh||fresh.status==="success")return;
      await tx.update(payments).set({status:"success",refCode:v.refId||pay.refCode,paidAt:new Date()}).where(eq(payments.id,pay.id));
      await tx.insert(customerWallets).values({userId:ownerId,balance:pay.amount}).onConflictDoUpdate({target:customerWallets.userId,set:{balance:sql`${customerWallets.balance}+${pay.amount}`,updatedAt:new Date()}});
      await tx.insert(customerWalletEntries).values({userId:ownerId,amount:pay.amount,type:"charge",description:"شارژ کیف پول از درگاه",reference:`gateway-payment:${pay.id}`}).onConflictDoNothing();
    });
    await audit(db,ctx,"payment.wallet_charge_success","customer_wallet",ownerId,null,{paymentId:pay.id,amount:pay.amount,refCode:v.refId});
    return {ok:true,paymentId:pay.id,message:"کیف پول با موفقیت شارژ شد",refId:v.refId};
  }
  try {
    if (pay.orderId) await payOrder(ctx, pay.orderId, `${provider === "zibal" ? "ziv" : "zpv"}:${pay.id}`, false, { method: "gateway", existingPaymentId: pay.id });
    else if (pay.supplyRequestId) await customerSupplyAction(ctx, pay.supplyRequestId, "pay", `${provider === "zibal" ? "ziv" : "zpv"}:${pay.id}`, pay.id);
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
