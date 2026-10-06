import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerWalletEntries, customerWallets, orderItems, orders, payments, supplyRequests, users } from "@/db/schema";
import { audit, notify } from "../audit";
import { HttpError } from "../util";
import { zpMode, zpRequest, zpVerify } from "../zarinpal";
import { zibalMode, zibalRequest, zibalVerify } from "../zibal";
import { getPaymentGatewayOptions, isGatewayEnabled, type GatewayId } from "../payment-gateways";
import { torobPayCreate, torobPayEligible, torobPayRevert, torobPaySettle, torobPayVerify } from "../torobpay";
import { getSettings } from "../settings";
import { payOrder } from "./orders";
import { customerSupplyAction } from "./supply";
import type { Ctx } from "../types";

export type GatewayTarget = { orderId: number } | { supplyId: number } | { walletAmount: number };
const torobCredentials = (s: Awaited<ReturnType<typeof getSettings>>) => ({ clientId: s.torobpayClientId, clientSecret: s.torobpayClientSecret, username: s.torobpayUsername, password: s.torobpayPassword });
const zarinpalSandbox = (s: Awaited<ReturnType<typeof getSettings>>) => s.zarinpalMerchantId.trim() ? !!s.zarinpalSandbox : undefined;

/** Step 1: create an initiated payment and return the selected gateway URL. */
export async function startGatewayPayment(ctx: Ctx & { userId: number }, target: GatewayTarget, baseUrl: string, requestedProvider?: GatewayId) {
  const settings = await getSettings();
  const [u] = await db.select().from(users).where(eq(users.id, ctx.userId));
  let amount = 0, torobGrossAmount = 0, description = "", ref: { orderId?: number; supplyRequestId?: number } = {}, number = "";
  if ("orderId" in target) {
    const [o] = await db.select().from(orders).where(eq(orders.id, target.orderId));
    if (!o || o.customerId !== ctx.userId) throw new HttpError(404, "سفارش یافت نشد");
    if (o.status !== "pending_payment") throw new HttpError(400, "این سفارش در وضعیت پرداخت نیست");
    if (o.paymentStatus === "pending_verification") throw new HttpError(400, "فیش پرداخت این سفارش در انتظار تأیید است");
    amount = o.total; torobGrossAmount = Number(o.itemsSubtotal ?? 0) + Number(o.sellerShippingTotal ?? 0) + Number(o.centralShipping ?? 0) + Number(o.tax ?? 0); description = `پرداخت سفارش ${o.number} - ${settings.siteName}`; ref = { orderId: o.id }; number = o.number;
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
  const options = getPaymentGatewayOptions(settings);
  const provider = requestedProvider ?? ("orderId" in target ? options[0]?.id : options.find((x) => x.id !== "torobpay")?.id);
  if (!provider || !isGatewayEnabled(settings, provider)) throw new HttpError(503, "درگاه انتخاب‌شده فعال نیست");
  if (provider === "torobpay" && !("orderId" in target)) throw new HttpError(400, "ترب‌پی فقط برای پرداخت سفارش قابل استفاده است");
  if (provider === "torobpay") {
    const eligibility = await torobPayEligible(torobCredentials(settings), torobGrossAmount * 10);
    if (!eligibility.eligible) throw new HttpError(400, eligibility.titleMessage || "این مبلغ برای پرداخت ترب‌پی واجد شرایط نیست");
  }
  // expire previous unfinished attempts
  const cond = ref.orderId ? eq(payments.orderId, ref.orderId) : ref.supplyRequestId ? eq(payments.supplyRequestId, ref.supplyRequestId) : null;
  if(cond)await db.update(payments).set({ status: "expired" }).where(and(cond, eq(payments.status, "initiated")));
  const mode = provider === "zibal" ? zibalMode(settings.zibalMerchant) : provider === "zarinpal" ? zpMode(settings.zarinpalMerchantId, zarinpalSandbox(settings)) : "live";
  const [pay] = await db.insert(payments).values({
    ...ref, amount, method: "gateway", status: "initiated", gateway: provider === "zibal" ? (mode === "sandbox" ? "zibal-sandbox" : "zibal") : provider === "torobpay" ? "torobpay" : mode === "simulator" ? "zarinpal-simulator" : mode === "sandbox" ? "zarinpal-sandbox" : "zarinpal",
    ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, recordedBy: ctx.userId, idempotencyKey: `${provider === "zibal" ? "zi" : provider === "torobpay" ? "tp" : "zp"}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    details: { number, ...( "walletAmount" in target ? { walletTopup: "true" } : {}) },
  }).returning();
  try {
    let url = "", authority = "";
    if (provider === "zibal") {
      const r = await zibalRequest({ amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/zibal/callback`, description, mobile: u?.phone, orderId: number, merchantId: settings.zibalMerchant });
      url = r.payUrl; authority = r.authority;
    } else if (provider === "zarinpal") {
      const r = await zpRequest({ amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/zarinpal/callback`, description, mobile: u?.phone, email: u?.email ?? undefined, orderId: number, merchantId: settings.zarinpalMerchantId, sandbox: zarinpalSandbox(settings) });
      url = r.payUrl.startsWith("/") ? `${baseUrl}${r.payUrl}` : r.payUrl; authority = r.authority;
    } else {
      if (!("orderId" in target)) throw new Error("ترب‌پی فقط برای پرداخت سفارش قابل استفاده است");
      const orderId = target.orderId;
      const torobTransactionId = `TOROB-${pay.id}-${Math.random().toString(36).slice(2, 10)}`;
      await db.update(payments).set({ details: { ...pay.details, torobTransactionId } }).where(eq(payments.id, pay.id));
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      if (!order || !lines.length) throw new Error("جزئیات سفارش برای ساخت درخواست ترب‌پی موجود نیست");
      const gross = Number(order.itemsSubtotal ?? 0) + Number(order.sellerShippingTotal ?? 0) + Number(order.centralShipping ?? 0) + Number(order.tax ?? 0);
      const external = Number(order.creditAmount ?? 0);
      await db.update(payments).set({ details: { ...pay.details, torobTransactionId, torobGrossAmount: String(gross), torobExternalSourceAmount: String(external) } }).where(eq(payments.id, pay.id));
      const r = await torobPayCreate(torobCredentials(settings), {
        amountToman: gross, discountToman: Number(order.discount ?? 0), externalSourceToman: external,
        shippingToman: Number(order.centralShipping ?? 0) + Number(order.sellerShippingTotal ?? 0), taxToman: Number(order.tax ?? 0),
        mobile: u?.phone ?? order.address.phone, returnUrl: `${baseUrl}/api/payments/torobpay/callback`, transactionId: torobTransactionId!, cartId: order.number,
        items: lines.map((line) => ({ id: `item-${line.id}`, name: line.title, count: line.qty, unitPriceToman: Number(line.unitPrice ?? 0), category: "محصولات ارگانیک" })),
        address: order.address.address, postalCode: order.address.postalCode ?? "", fullName: order.address.fullName, city: order.address.city, province: order.address.city,
      });
      url = r.paymentPageUrl; authority = r.paymentToken;
    }
    await db.update(payments).set({ authority }).where(eq(payments.id, pay.id));
    await audit(db, ctx, "payment.gateway_start", ref.orderId ? "order" : ref.supplyRequestId ? "supply_request" : "customer_wallet", ref.orderId ?? ref.supplyRequestId ?? ctx.userId, null, { paymentId: pay.id, amount, mode, provider });
    return { url, paymentId: pay.id, mode, provider };
  } catch (e) {
    await db.update(payments).set({ status: "failed", note: (e as Error).message.slice(0, 300) }).where(eq(payments.id, pay.id));
    throw new HttpError(502, (e as Error).message || "اتصال به درگاه برقرار نشد");
  }
}

/** Step 2: verify with the original provider and settle the order/supply. Safe to call repeatedly. */
export async function handleGatewayCallback(authority: string, status: string, simulatedOk: boolean, meta: { ip?: string | null; ua?: string | null }, requestedProvider?: GatewayId, torobTransactionId?: string) {
  const [pay] = await db.select().from(payments).where(and(eq(payments.authority, authority), eq(payments.method, "gateway")));
  if (!pay) return { ok: false, paymentId: null, message: "تراکنش یافت نشد" };
  if (pay.status === "success") return { ok: true, paymentId: pay.id, message: "پرداخت قبلاً تأیید شده است" };
  if (!["initiated"].includes(pay.status)) return { ok: false, paymentId: pay.id, message: pay.status === "needs_refund" ? "پرداخت انجام شد ولی سفارش قابل تأیید نبود؛ مبلغ مسترد می‌شود" : "این تراکنش معتبر نیست یا منقضی شده است" };
  const ownerId = pay.recordedBy!;
  const ctx = { userId: ownerId, ip: meta.ip, ua: meta.ua };
  const provider: GatewayId = pay.gateway?.startsWith("zibal") ? "zibal" : pay.gateway?.startsWith("torobpay") ? "torobpay" : "zarinpal";
  if (requestedProvider && requestedProvider !== provider) return { ok: false, paymentId: pay.id, message: "درگاه بازگشت با تراکنش مطابقت ندارد" };
  if (provider === "torobpay" && (!torobTransactionId || torobTransactionId !== pay.details.torobTransactionId)) return { ok: false, paymentId: pay.id, message: "شناسه بازگشت ترب‌پی با تراکنش مطابقت ندارد" };
  if ((provider === "zarinpal" && status !== "OK") || (provider === "zibal" && status !== "1") || (provider === "torobpay" && status !== "OK")) {
    await db.update(payments).set({ status: "cancelled", note: "انصراف کاربر یا تراکنش ناموفق در درگاه" }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated")));
    await audit(db, ctx, "payment.gateway_cancel", "payment", pay.id, null, { status });
    return { ok: false, paymentId: pay.id, message: "پرداخت توسط شما لغو شد یا ناموفق بود" };
  }
  let v;
  try {
    const settings = await getSettings();
    if (provider === "zibal") v = await zibalVerify(authority, pay.amount * 10, settings.zibalMerchant);
    else if (provider === "torobpay") {
      const transactionId = await torobPayVerify(torobCredentials(settings), authority);
      if (transactionId !== torobTransactionId) throw new Error("شناسه تراکنش تأییدشده ترب‌پی مطابقت ندارد");
      await torobPaySettle(torobCredentials(settings), authority);
      v = { ok: true, code: 200, refId: transactionId, message: "پرداخت ترب‌پی تأیید و تسویه شد", raw: {} };
    } else v = await zpVerify(authority, pay.amount * 10, zpMode(settings.zarinpalMerchantId, zarinpalSandbox(settings)) === "simulator" ? simulatedOk : undefined, settings.zarinpalMerchantId, zarinpalSandbox(settings));
  } catch (e) {
    if (provider === "torobpay") {
      try { await torobPayRevert(torobCredentials(await getSettings()), authority); } catch (revertError) { console.error("TorobPay revert failed", revertError); }
      await db.update(payments).set({ status: "failed", note: `تأیید ترب‌پی ناموفق بود: ${(e as Error).message}` }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated")));
      await audit(db, ctx, "payment.gateway_failed", "payment", pay.id, null, { provider, error: (e as Error).message });
      return { ok: false, paymentId: pay.id, message: `تأیید پرداخت ترب‌پی ناموفق بود: ${(e as Error).message}` };
    }
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
    if (provider === "torobpay") {
      try { await torobPayRevert(torobCredentials(await getSettings()), authority); } catch (revertError) { console.error("TorobPay revert failed", revertError); }
    }
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
