import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerWalletEntries, customerWallets, orderItems, orders, payments, supplyRequests, users } from "@/db/schema";
import { audit, notify } from "../audit";
import { HttpError } from "../util";
import { zpMode, zpRequest, zpVerify } from "../zarinpal";
import { zibalMode, zibalRequest, zibalVerify } from "../zibal";
import { getPaymentGatewayOptions, isGatewayEnabled, type GatewayId } from "../payment-gateways";
import { torobPayCreate, torobPayEligible, torobPayRevert, torobPaySettle, torobPayVerify } from "../torobpay";
import { nextPayRequest, nextPayVerify } from "../nextpay";
import { digipayAmount, digipayCreateTicket, digipayVerify } from "../digipay";
import { snapPayCreateToken, snapPayEligibility, snapPayRevert, snapPayVerifyAndSettle } from "../snappay";
import { behpardakhtCreatePayment, behpardakhtVerifyAndSettle } from "../behpardakht";
import { vandarCreate, vandarVerify } from "../vandar";
import { pasargadCreate, pasargadConfirm } from "../pasargad";
import { getSettings } from "../settings";
import { payOrder } from "./orders";
import { customerSupplyAction } from "./supply";
import type { Ctx } from "../types";

export type GatewayTarget = { orderId: number } | { supplyId: number } | { walletAmount: number };
const torobCredentials = (s: Awaited<ReturnType<typeof getSettings>>) => ({ clientId: s.torobpayClientId, clientSecret: s.torobpayClientSecret, username: s.torobpayUsername, password: s.torobpayPassword });
const zarinpalSandbox = (s: Awaited<ReturnType<typeof getSettings>>) => s.zarinpalMerchantId.trim() ? !!s.zarinpalSandbox : undefined;
const digipayCredentials = (s: Awaited<ReturnType<typeof getSettings>>) => ({ clientId: s.digipayClientId, clientSecret: s.digipayClientSecret, username: s.digipayUsername, password: s.digipayPassword, sandbox: !!s.digipaySandbox });
const snapPayCredentials = (s: Awaited<ReturnType<typeof getSettings>>) => ({ baseUrl: s.snappayApiBaseUrl, clientId: s.snappayClientId, clientSecret: s.snappayClientSecret, username: s.snappayUsername, password: s.snappayPassword });
const behpardakhtCredentials = (s: Awaited<ReturnType<typeof getSettings>>) => ({ terminalId: s.behpardakhtTerminalId, username: s.behpardakhtUsername, password: s.behpardakhtPassword });

function snapPayTransactionId(paymentId: number) {
  const digits = String(paymentId);
  return digits.length <= 10 ? digits.padStart(8, "0") : `S${digits}`;
}

function snapPayMobile(value: string | null | undefined) {
  return String(value ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
}

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
  const provider = requestedProvider ?? options.find((x) => "orderId" in target || !["torobpay", "snappay"].includes(x.id))?.id;
  if (!provider || !isGatewayEnabled(settings, provider)) throw new HttpError(503, "درگاه انتخاب‌شده فعال نیست");
  if (provider === "torobpay" && !("orderId" in target)) throw new HttpError(400, "ترب‌پی فقط برای پرداخت سفارش قابل استفاده است");
  if (provider === "snappay" && !("orderId" in target)) throw new HttpError(400, "اسنپ‌پی فقط برای پرداخت سفارش قابل استفاده است");
  if (provider === "vandar" && !settings.vandarApiKey.trim()) throw new HttpError(503, "کلید API وندار در تنظیمات وارد نشده است");
  if (provider === "pasargad" && (!settings.pasargadTerminalId.trim() || !settings.pasargadUsername.trim() || !settings.pasargadPassword.trim())) throw new HttpError(503, "اطلاعات پایانه و پذیرندهٔ پاسارگاد در تنظیمات کامل نیست");
  if (provider === "torobpay") {
    const eligibility = await torobPayEligible(torobCredentials(settings), torobGrossAmount * 10);
    if (!eligibility.eligible) throw new HttpError(400, eligibility.titleMessage || "این مبلغ برای پرداخت ترب‌پی واجد شرایط نیست");
  }
  if (provider === "snappay") {
    const eligibility = await snapPayEligibility(snapPayCredentials(settings), amount * 10);
    if (!eligibility.eligible) throw new HttpError(400, eligibility.titleMessage || "این سفارش برای پرداخت اسنپ‌پی واجد شرایط نیست");
    if (!/^09\d{9}$/.test(snapPayMobile(u?.phone))) throw new HttpError(400, "برای پرداخت اسنپ‌پی، شماره موبایل معتبر در پروفایل ثبت کنید");
  }
  // expire previous unfinished attempts
  const cond = ref.orderId ? eq(payments.orderId, ref.orderId) : ref.supplyRequestId ? eq(payments.supplyRequestId, ref.supplyRequestId) : null;
  if(cond)await db.update(payments).set({ status: "expired" }).where(and(cond, eq(payments.status, "initiated")));
  const mode = provider === "zibal" ? zibalMode(settings.zibalMerchant) : provider === "zarinpal" ? zpMode(settings.zarinpalMerchantId, zarinpalSandbox(settings)) : provider === "digipay" && settings.digipaySandbox ? "sandbox" : "live";
  const [pay] = await db.insert(payments).values({
    ...ref, amount, method: "gateway", status: "initiated", gateway: provider === "zibal" ? (mode === "sandbox" ? "zibal-sandbox" : "zibal") : provider === "torobpay" ? "torobpay" : provider === "nextpay" ? "nextpay" : provider === "digipay" ? (settings.digipaySandbox ? "digipay-sandbox" : "digipay") : provider,
    ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, recordedBy: ctx.userId, idempotencyKey: `${provider.slice(0, 2)}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
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
    } else if (provider === "torobpay") {
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
    } else if (provider === "nextpay") {
      const nextpayOrderId = `NP-${pay.id}`;
      await db.update(payments).set({ details: { ...pay.details, nextpayOrderId } }).where(eq(payments.id, pay.id));
      const r = await nextPayRequest({ apiKey: settings.nextpayApiKey, orderId: nextpayOrderId, amountToman: amount, callbackUrl: `${baseUrl}/api/payments/nextpay/callback` });
      url = r.payUrl; authority = r.authority;
    } else if (provider === "digipay") {
      const providerId = `DG-${pay.id}-${Math.random().toString(36).slice(2, 10)}`;
      await db.update(payments).set({ details: { ...pay.details, digipayProviderId: providerId } }).where(eq(payments.id, pay.id));
      const r = await digipayCreateTicket(digipayCredentials(settings), {
        amount: digipayAmount(amount, Number(settings.digipayAmountMultiplier) || 10), phone: u?.phone ?? "", providerId,
        callbackUrl: `${baseUrl}/api/payments/digipay/callback`,
        preferredGateway: Number(settings.digipayPreferredGateway) === 0 || Number(settings.digipayPreferredGateway) === 2 ? Number(settings.digipayPreferredGateway) : undefined,
      });
      url = r.redirectUrl; authority = providerId;
      await db.update(payments).set({ details: { ...pay.details, digipayProviderId: providerId, digipayTicket: r.ticket } }).where(eq(payments.id, pay.id));
    } else if (provider === "snappay") {
      if (!("orderId" in target)) throw new Error("اسنپ‌پی فقط برای پرداخت سفارش قابل استفاده است");
      const [order] = await db.select().from(orders).where(eq(orders.id, target.orderId));
      const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, target.orderId));
      if (!order || !lines.length) throw new Error("جزئیات سفارش برای ساخت درخواست اسنپ‌پی موجود نیست");
      const transactionId = snapPayTransactionId(pay.id);
      const itemsGross = Number(order.itemsSubtotal ?? 0), shipping = Number(order.sellerShippingTotal ?? 0) + Number(order.centralShipping ?? 0), tax = Number(order.tax ?? 0);
      const orderGross = itemsGross + shipping + tax;
      if (orderGross - Number(order.discount ?? 0) - Number(order.creditAmount ?? 0) !== amount) throw new Error("مجموع سفارش با مبلغ قابل پرداخت اسنپ‌پی مطابقت ندارد");
      const callbackUrl = `${baseUrl}/api/payments/snappay/callback`;
      const r = await snapPayCreateToken(snapPayCredentials(settings), {
        amount: amount * 10, discountAmount: Number(order.discount ?? 0) * 10, externalSourceAmount: Number(order.creditAmount ?? 0) * 10,
        mobile: snapPayMobile(u?.phone ?? order.address.phone), returnURL: callbackUrl, transactionId,
        cartList: [{
          cartId: order.id,
          cartItems: lines.map((line) => ({ amount: Number(line.unitPrice ?? 0) * 10, category: "محصولات ارگانیک", count: line.qty, id: line.id, name: line.title, commissionType: 100 })),
          isShipmentIncluded: true, isTaxIncluded: true, shippingAmount: shipping * 10, taxAmount: tax * 10, totalAmount: orderGross * 10,
        }],
      });
      url = r.paymentPageUrl; authority = r.paymentToken;
      await db.update(payments).set({ details: { ...pay.details, snappayTransactionId: transactionId, snappayCallbackUrl: callbackUrl } }).where(eq(payments.id, pay.id));
    } else if (provider === "behpardakht") {
      const transaction = await behpardakhtCreatePayment(behpardakhtCredentials(settings), { paymentId: pay.id, amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/behpardakht/callback`, description: description.slice(0, 500) });
      url = transaction.payUrl; authority = transaction.refId;
      await db.update(payments).set({ details: { ...pay.details, behpardakhtOrderId: String(transaction.orderId) } }).where(eq(payments.id, pay.id));
    } else if (provider === "vandar") {
      const invoice = String(pay.id);
      const result = await vandarCreate(settings.vandarApiKey, { amountRial: amount * 10, callbackUrl: `${baseUrl}/api/payments/vandar/callback`, mobile: u?.phone ?? undefined, invoice, description });
      url = result.payUrl; authority = result.token;
      await db.update(payments).set({ details: { ...pay.details, vandarInvoice: invoice } }).where(eq(payments.id, pay.id));
    } else if (provider === "pasargad") {
      const invoice = String(pay.id);
      const result = await pasargadCreate({ username: settings.pasargadUsername, password: settings.pasargadPassword, terminalId: settings.pasargadTerminalId }, { amountRial: amount * 10, invoice, callbackUrl: `${baseUrl}/api/payments/pasargad/callback`, mobile: u?.phone ?? undefined });
      url = result.payUrl; authority = result.urlId;
      await db.update(payments).set({ details: { ...pay.details, pasargadInvoice: invoice, pasargadUrlId: result.urlId } }).where(eq(payments.id, pay.id));
    } else {
      throw new Error(`اتصال ${provider} هنوز قرارداد فنی پذیرنده برای این فروشگاه را ندارد`);
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
export async function handleGatewayCallback(authority: string, status: string, simulatedOk: boolean, meta: { ip?: string | null; ua?: string | null }, requestedProvider?: GatewayId, torobTransactionId?: string, nextpayCallback?: { orderId: string; transId: string }, digipayCallback?: { providerId: string; trackingCode: string; amount: number; result: string; type: number }, snappayCallback?: { transactionId: string; state: string; amount: number }, behpardakhtCallback?: { orderId: number; saleOrderId: number; saleReferenceId: number; responseCode: string }, providerCallback?: { invoice: string; urlId?: string }) {
  const [pay] = await db.select().from(payments).where(and(eq(payments.authority, authority), eq(payments.method, "gateway")));
  if (!pay) return { ok: false, paymentId: null, message: "تراکنش یافت نشد" };
  if (pay.status === "success") return { ok: true, paymentId: pay.id, message: "پرداخت قبلاً تأیید شده است" };
  if (!["initiated", "verifying", "provider_settled"].includes(pay.status)) return { ok: false, paymentId: pay.id, message: pay.status === "needs_refund" ? "پرداخت انجام شد ولی سفارش قابل تأیید نبود؛ مبلغ مسترد می‌شود" : "این تراکنش معتبر نیست یا منقضی شده است" };
  const ownerId = pay.recordedBy!;
  const ctx = { userId: ownerId, ip: meta.ip, ua: meta.ua };
  const provider: GatewayId = pay.gateway?.startsWith("zibal") ? "zibal" : pay.gateway?.startsWith("torobpay") ? "torobpay" : pay.gateway?.startsWith("nextpay") ? "nextpay" : pay.gateway?.startsWith("digipay") ? "digipay" : pay.gateway?.startsWith("snappay") ? "snappay" : pay.gateway?.startsWith("behpardakht") ? "behpardakht" : (pay.gateway as GatewayId) || "zarinpal";
  if (requestedProvider && requestedProvider !== provider) return { ok: false, paymentId: pay.id, message: "درگاه بازگشت با تراکنش مطابقت ندارد" };
  if (provider === "torobpay" && (!torobTransactionId || torobTransactionId !== pay.details.torobTransactionId)) return { ok: false, paymentId: pay.id, message: "شناسه بازگشت ترب‌پی با تراکنش مطابقت ندارد" };
  if (provider === "nextpay" && (!nextpayCallback || nextpayCallback.orderId !== pay.details.nextpayOrderId || nextpayCallback.transId !== authority)) return { ok: false, paymentId: pay.id, message: "شناسه‌های بازگشت نکست‌پی با تراکنش مطابقت ندارند" };
  if (provider === "digipay" && (!digipayCallback || digipayCallback.providerId !== pay.details.digipayProviderId || authority !== digipayCallback.providerId)) return { ok: false, paymentId: pay.id, message: "شناسه بازگشت دیجی‌پی با تراکنش مطابقت ندارد" };
  if (provider === "snappay" && (!snappayCallback || snappayCallback.transactionId !== pay.details.snappayTransactionId || !pay.orderId || authority !== pay.authority || snappayCallback.amount !== pay.amount * 10)) return { ok: false, paymentId: pay.id, message: "مبلغ یا شناسهٔ بازگشت اسنپ‌پی با تراکنش مطابقت ندارد" };
  if (provider === "behpardakht" && (!behpardakhtCallback || !pay.details.behpardakhtOrderId || behpardakhtCallback.orderId !== Number(pay.details.behpardakhtOrderId) || behpardakhtCallback.saleOrderId !== Number(pay.details.behpardakhtOrderId) || (behpardakhtCallback.responseCode === "0" && behpardakhtCallback.saleReferenceId < 1))) return { ok: false, paymentId: pay.id, message: "شناسه یا نتیجهٔ بازگشت به‌پرداخت با تراکنش مطابقت ندارد" };
  if ((provider === "vandar" || provider === "pasargad") && (!providerCallback?.invoice || providerCallback.invoice !== pay.details[provider === "vandar" ? "vandarInvoice" : "pasargadInvoice"] || (provider === "pasargad" && providerCallback.urlId !== pay.details.pasargadUrlId))) return { ok: false, paymentId: pay.id, message: "شماره فاکتور یا شناسهٔ بازگشت با تراکنش مطابقت ندارد" };
  if ((provider === "zarinpal" && status !== "OK") || (provider === "zibal" && status !== "1") || (provider === "torobpay" && status !== "OK") || (provider === "digipay" && digipayCallback?.result !== "SUCCESS") || (provider === "snappay" && snappayCallback?.state !== "OK") || (provider === "behpardakht" && behpardakhtCallback?.responseCode !== "0") || (provider === "vandar" && status !== "OK") || (provider === "pasargad" && !["0", "1", "OK", "SUCCESS"].includes(status.toUpperCase()))) {
    if (provider === "snappay" && pay.authority) { try { await snapPayRevert(snapPayCredentials(await getSettings()), pay.authority); } catch (error) { console.error("Snappay revert failed", error); } }
    await db.update(payments).set({ status: "cancelled", note: "انصراف کاربر یا تراکنش ناموفق در درگاه" }).where(and(eq(payments.id, pay.id), inArray(payments.status, ["initiated", "verifying"])));
    await audit(db, ctx, "payment.gateway_cancel", "payment", pay.id, null, { status });
    return { ok: false, paymentId: pay.id, message: "پرداخت توسط شما لغو شد یا ناموفق بود" };
  }
  let v: { ok: boolean; code: number; refId?: string; cardPan?: string; cardHash?: string; fee?: number; feeType?: string; message: string; raw?: unknown };
  try {
    const settings = await getSettings();
    if ((provider === "snappay" || provider === "behpardakht") && pay.status === "provider_settled") v = { ok: true, code: 200, refId: pay.refCode ?? (provider === "snappay" ? snappayCallback!.transactionId : String(behpardakhtCallback!.saleReferenceId)), message: "پرداخت قبلاً توسط درگاه نهایی شده است", raw: {} };
    else if (provider === "zibal") v = await zibalVerify(authority, pay.amount * 10, settings.zibalMerchant);
    else if (provider === "torobpay") {
      const transactionId = await torobPayVerify(torobCredentials(settings), authority);
      if (transactionId !== torobTransactionId) throw new Error("شناسه تراکنش تأییدشده ترب‌پی مطابقت ندارد");
      await torobPaySettle(torobCredentials(settings), authority);
      v = { ok: true, code: 200, refId: transactionId, message: "پرداخت ترب‌پی تأیید و تسویه شد", raw: {} };
    } else if (provider === "nextpay") v = await nextPayVerify({ apiKey: settings.nextpayApiKey, orderId: String(pay.details.nextpayOrderId), amountToman: pay.amount, transId: authority });
    else if (provider === "digipay") {
      const callback = digipayCallback!;
      const multiplier = Number(settings.digipayAmountMultiplier) || 10;
      const expectedAmount = digipayAmount(pay.amount, multiplier);
      if (callback.amount !== expectedAmount) throw new Error("مبلغ اعلام‌شده در بازگشت دیجی‌پی با مبلغ سفارش مطابقت ندارد");
      if (![0, 5, 11, 13, 24].includes(callback.type)) throw new Error("نوع تراکنش بازگشت‌داده‌شده دیجی‌پی معتبر نیست");
      const verified = await digipayVerify(digipayCredentials(settings), { trackingCode: callback.trackingCode, providerId: callback.providerId, type: callback.type });
      if (String(verified.response.providerId) !== callback.providerId || Number(verified.response.amount) !== expectedAmount) throw new Error("مبلغ یا شناسه تأییدشده دیجی‌پی با سفارش مطابقت ندارد");
      v = { ok: verified.ok, code: Number(verified.response.result?.status ?? -1), refId: callback.trackingCode, cardPan: verified.response.maskedPan, message: verified.message, raw: verified.response };
    }
    else if (provider === "snappay") {
      const callback = snappayCallback!;
      if (pay.status === "verifying" && Date.now() - Number(pay.details.snappayCallbackStartedAt ?? 0) < 30_000) return { ok: false, paymentId: pay.id, message: "نتیجهٔ پرداخت اسنپ‌پی در حال بررسی است؛ چند لحظه دیگر صفحهٔ سفارش را بازخوانی کنید" };
      if (pay.status === "initiated") {
        const [claimed] = await db.update(payments).set({ status: "verifying", details: { ...pay.details, snappayCallbackStartedAt: String(Date.now()) } }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated"))).returning({ id: payments.id });
        if (!claimed) return { ok: false, paymentId: pay.id, message: "نتیجهٔ پرداخت اسنپ‌پی در حال بررسی است" };
      } else if (pay.status === "verifying") {
        await db.update(payments).set({ details: { ...pay.details, snappayCallbackStartedAt: String(Date.now()) } }).where(and(eq(payments.id, pay.id), eq(payments.status, "verifying")));
      }
      const settled = await snapPayVerifyAndSettle(snapPayCredentials(settings), authority, callback.transactionId, pay.amount * 10, pay.status === "verifying");
      await db.update(payments).set({ status: "provider_settled", refCode: settled.transactionId, paidAt: new Date(), details: { ...pay.details, snappayState: "SETTLE" } }).where(eq(payments.id, pay.id));
      v = { ok: true, code: 200, refId: settled.transactionId, message: "پرداخت اسنپ‌پی تأیید و نهایی شد", raw: { transactionId: settled.transactionId } };
    }
    else if (provider === "behpardakht") {
      const callback = behpardakhtCallback!;
      if (pay.status === "verifying" && Date.now() - Number(pay.details.behpardakhtCallbackStartedAt ?? 0) < 30_000) return { ok: false, paymentId: pay.id, message: "نتیجهٔ پرداخت به‌پرداخت در حال بررسی است؛ چند لحظه دیگر صفحهٔ سفارش را بازخوانی کنید" };
      if (pay.status === "initiated") {
        const [claimed] = await db.update(payments).set({ status: "verifying", details: { ...pay.details, behpardakhtCallbackStartedAt: String(Date.now()) } }).where(and(eq(payments.id, pay.id), eq(payments.status, "initiated"))).returning({ id: payments.id });
        if (!claimed) return { ok: false, paymentId: pay.id, message: "نتیجهٔ پرداخت به‌پرداخت در حال بررسی است" };
      } else if (pay.status === "verifying") {
        await db.update(payments).set({ details: { ...pay.details, behpardakhtCallbackStartedAt: String(Date.now()) } }).where(and(eq(payments.id, pay.id), eq(payments.status, "verifying")));
      }
      const transaction = await behpardakhtVerifyAndSettle(behpardakhtCredentials(settings), { orderId: Number(pay.details.behpardakhtOrderId), saleOrderId: callback.saleOrderId, saleReferenceId: callback.saleReferenceId });
      await db.update(payments).set({ status: "provider_settled", refCode: String(transaction.referenceId), paidAt: new Date(), details: { ...pay.details, behpardakhtState: "SETTLE" } }).where(eq(payments.id, pay.id));
      v = { ok: true, code: 200, refId: String(transaction.referenceId), message: "پرداخت به‌پرداخت تأیید و تسویه شد", raw: transaction };
    }
    else if (provider === "vandar") {
      const result = await vandarVerify(settings.vandarApiKey, authority, pay.amount * 10, String(pay.details.vandarInvoice));
      v = { ok: true, code: 200, refId: result.refId, cardPan: result.cardPan, message: "پرداخت وندار تأیید شد" };
    }
    else if (provider === "pasargad") {
      const result = await pasargadConfirm({ username: settings.pasargadUsername, password: settings.pasargadPassword }, String(pay.details.pasargadInvoice), String(pay.details.pasargadUrlId), pay.amount * 10);
      v = { ok: true, code: 200, refId: result.refId, cardPan: result.cardPan, message: "پرداخت پاسارگاد تأیید شد" };
    }
    else v = await zpVerify(authority, pay.amount * 10, zpMode(settings.zarinpalMerchantId, zarinpalSandbox(settings)) === "simulator" ? simulatedOk : undefined, settings.zarinpalMerchantId, zarinpalSandbox(settings));
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
    details: { ...pay.details, ...(provider === "snappay" ? { snappayState: "SETTLE" } : {}), ...(provider === "behpardakht" ? { behpardakhtState: "SETTLE" } : {}), verifyCode: String(v.code), ...(v.cardHash ? { cardHash: v.cardHash.slice(0, 16) + "…" } : {}), ...(v.fee !== undefined ? { fee: String(v.fee), feeType: v.feeType ?? "" } : {}) },
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
    const verifyKey = ({ zibal: "ziv", nextpay: "npv", torobpay: "tpv", digipay: "dgv", snappay: "spv", behpardakht: "bmv", vandar: "vav", pasargad: "pav" } as Partial<Record<GatewayId,string>>)[provider] ?? "zpv";
    if (pay.orderId) await payOrder(ctx, pay.orderId, `${verifyKey}:${pay.id}`, false, { method: "gateway", existingPaymentId: pay.id });
    else if (pay.supplyRequestId) await customerSupplyAction(ctx, pay.supplyRequestId, "pay", `${verifyKey}:${pay.id}`, pay.id);
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
