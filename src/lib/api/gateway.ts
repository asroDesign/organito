import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, requireApi } from "../auth";
import { startGatewayPayment, handleGatewayCallback } from "../services/gateway";
import { zpMode } from "../zarinpal";
import { str } from "../util";
import { body, idParam, type Route } from "./router";
import { HttpError } from "../util";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "../settings";
import { getPaymentGatewayOptions } from "../payment-gateways";
import { torobPayEligible } from "../torobpay";
import { snapPayEligibility } from "../snappay";

const snapPayCredentials = (s: Awaited<ReturnType<typeof getSettings>>) => ({ baseUrl: s.snappayApiBaseUrl, clientId: s.snappayClientId, clientSecret: s.snappayClientSecret, username: s.snappayUsername, password: s.snappayPassword });

export function baseUrl(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host).split(",")[0].trim();
  const forwardedProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : req.nextUrl.protocol.replace(":", "");
  try {
    const active = new URL(proto + "://" + host);
    if (!["http:", "https:"].includes(active.protocol) || active.username || active.password || active.pathname !== "/") throw new Error();
    if (process.env.NODE_ENV === "production" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(active.hostname)) throw new Error();
    return active.origin;
  } catch {
    const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (configured) {
      try {
        const fallback = new URL(configured);
        const isLocal = ["localhost", "127.0.0.1", "0.0.0.0"].includes(fallback.hostname);
        if (["http:", "https:"].includes(fallback.protocol) && !(process.env.NODE_ENV === "production" && isLocal)) return fallback.origin;
      } catch {}
    }
    throw new HttpError(500, "دامنه عمومی سایت برای بازگشت از درگاه در دسترس نیست");
  }
}

export const gatewayRoutes: Route[] = [
  { method: "POST", pattern: "payments/torobpay/eligible", handler: async (req) => {
    const u = await requireApi(); rateLimit(`gw:${u.id}`, 20, 60_000);
    const settings = await getSettings();
    if (!getPaymentGatewayOptions(settings).some((x) => x.id === "torobpay")) throw new HttpError(404, "ترب‌پی فعال نیست");
    const b = await body(req), amount = Number(b.amount);
    if (!Number.isSafeInteger(amount) || amount < 1) throw new HttpError(400, "مبلغ سفارش نامعتبر است");
    return torobPayEligible({ clientId: settings.torobpayClientId, clientSecret: settings.torobpayClientSecret, username: settings.torobpayUsername, password: settings.torobpayPassword }, amount * 10);
  } },
  { method: "POST", pattern: "payments/snappay/eligible", handler: async (req) => {
    const u = await requireApi(); rateLimit(`gw:${u.id}`, 20, 60_000);
    const settings = await getSettings();
    if (!getPaymentGatewayOptions(settings).some((x) => x.id === "snappay")) throw new HttpError(404, "اسنپ‌پی فعال نیست");
    const b = await body(req), amount = Number(b.amount);
    if (!Number.isSafeInteger(amount) || amount < 1) throw new HttpError(400, "مبلغ سفارش نامعتبر است");
    try { return await snapPayEligibility(snapPayCredentials(settings), amount * 10); }
    catch { return { eligible: false, titleMessage: "امکان پرداخت اسنپ‌پی بررسی نشد", description: "اتصال یا تنظیمات پذیرنده در دسترس نیست؛ روش‌های پرداخت دیگر همچنان قابل انتخاب‌اند." }; }
  } },
  { method: "POST", pattern: "orders/:id/gateway", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`gw:${u.id}`, 10, 60_000);
    const b = await body(req), provider = ["zarinpal", "zibal", "torobpay", "nextpay", "digipay", "snappay", "behpardakht", "vandar", "pasargad"].includes(String(b.provider)) ? String(b.provider) as "zarinpal" | "zibal" | "torobpay" | "nextpay" | "digipay" | "snappay" | "behpardakht" | "vandar" | "pasargad" : undefined;
    return startGatewayPayment({ userId: u.id, ...m }, { orderId: idParam(p.id) }, baseUrl(req), provider);
  } },
  { method: "POST", pattern: "supply/:id/gateway", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`gw:${u.id}`, 10, 60_000);
    return startGatewayPayment({ userId: u.id, ...m }, { supplyId: idParam(p.id) }, baseUrl(req));
  } },
  { method: "POST", pattern: "customer/wallet/gateway", handler: async (req, _p, m) => {
    const u=await requireApi();rateLimit(`gw:${u.id}`,10,60_000);const b=await body(req);const amount=Number(b.amount);if(!Number.isSafeInteger(amount)||amount<10000||amount>100_000_000)throw new HttpError(400,"مبلغ شارژ باید بین ۱۰ هزار تا ۱۰۰ میلیون تومان باشد");return startGatewayPayment({userId:u.id,...m},{walletAmount:amount},baseUrl(req));
  } },
  { method: "GET", pattern: "payments/zarinpal/callback", handler: async (req, _p, m) => {
    const q = req.nextUrl.searchParams;
    const authority = str(q.get("Authority"), 64);
    const status = str(q.get("Status"), 5);
    const sim = zpMode() === "simulator" && q.get("sim") === "ok";
    const r = authority ? await handleGatewayCallback(authority, status, sim, m, "zarinpal") : { ok: false, paymentId: null, message: "پارامتر Authority ارسال نشده است" };
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", r.ok ? "1" : "0");
    if (r.paymentId) url.searchParams.set("pid", String(r.paymentId));
    url.searchParams.set("msg", r.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "GET", pattern: "payments/zibal/callback", handler: async (req, _p, m) => {
    const q = req.nextUrl.searchParams;
    const trackId = str(q.get("trackId"), 64), success = str(q.get("success"), 5);
    const r = trackId ? await handleGatewayCallback(trackId, success, false, m, "zibal") : { ok: false, paymentId: null, message: "پارامتر trackId ارسال نشده است" };
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", r.ok ? "1" : "0"); if (r.paymentId) url.searchParams.set("pid", String(r.paymentId)); url.searchParams.set("msg", r.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "POST", pattern: "payments/torobpay/callback", csrf: false, handler: async (req, _p, m) => {
    const form = await req.formData();
    const transactionId = str(form.get("transactionId"), 100), state = str(form.get("state"), 30);
    const match = /^TOROB-(\d+)-[A-Za-z0-9]+$/.exec(transactionId);
    const [pay] = match ? await db.select().from(payments).where(eq(payments.id, Number(match[1]))) : [];
    let result: { ok: boolean; paymentId: number | null; message: string };
    if (!pay || pay.gateway !== "torobpay" || pay.details.torobTransactionId !== transactionId || !pay.authority) result = { ok: false, paymentId: pay?.id ?? null, message: "تراکنش بازگشت‌داده‌شده ترب‌پی معتبر نیست" };
    else result = await handleGatewayCallback(pay.authority, state, false, { ip: m.ip, ua: m.ua }, "torobpay", transactionId);
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", result.ok ? "1" : "0");
    if (result.paymentId) url.searchParams.set("pid", String(result.paymentId));
    url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "POST", pattern: "payments/nextpay/callback", csrf: false, handler: async (req, _p, m) => {
    let fields: FormData;
    try { fields = await req.formData(); } catch { fields = new FormData(); }
    const orderId = str(fields.get("order_id"), 40), transId = str(fields.get("trans_id"), 100);
    const match = /^NP-(\d+)$/.exec(orderId);
    const [pay] = match ? await db.select().from(payments).where(eq(payments.id, Number(match[1]))) : [];
    let result: { ok: boolean; paymentId: number | null; message: string };
    if (!pay || pay.gateway !== "nextpay" || pay.details.nextpayOrderId !== orderId || !transId || pay.authority !== transId) result = { ok: false, paymentId: pay?.id ?? null, message: "تراکنش بازگشت‌داده‌شده نکست‌پی معتبر نیست" };
    else result = await handleGatewayCallback(transId, "", false, { ip: m.ip, ua: m.ua }, "nextpay", undefined, { orderId, transId });
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", result.ok ? "1" : "0");
    if (result.paymentId) url.searchParams.set("pid", String(result.paymentId));
    url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "POST", pattern: "payments/digipay/callback", csrf: false, handler: async (req, _p, m) => {
    let values: Record<string, unknown> = {};
    try {
      const form = await req.formData();
      for (const [key, value] of form.entries()) values[key] = typeof value === "string" ? value : "";
    } catch {
      try { values = await req.json() as Record<string, unknown>; } catch { values = {}; }
    }
    const providerId = str(values.providerId, 120);
    const trackingCode = str(values.trackingCode, 120);
    const amount = Number(values.amount);
    const resultState = str(values.result, 20);
    const type = Number(values.type);
    const match = /^DG-(\d+)-[A-Za-z0-9]+$/.exec(providerId);
    const [pay] = match ? await db.select().from(payments).where(eq(payments.id, Number(match[1]))) : [];
    let result: { ok: boolean; paymentId: number | null; message: string };
    if (!pay || !pay.gateway?.startsWith("digipay") || pay.details.digipayProviderId !== providerId || !trackingCode || !Number.isSafeInteger(amount) || !["SUCCESS", "FAILURE"].includes(resultState)) {
      result = { ok: false, paymentId: pay?.id ?? null, message: "اطلاعات بازگشت‌داده‌شده دیجی‌پی معتبر نیست" };
    } else {
      result = await handleGatewayCallback(providerId, resultState, false, { ip: m.ip, ua: m.ua }, "digipay", undefined, undefined, { providerId, trackingCode, amount, result: resultState, type });
    }
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", result.ok ? "1" : "0");
    if (result.paymentId) url.searchParams.set("pid", String(result.paymentId));
    url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "POST", pattern: "payments/snappay/callback", csrf: false, handler: async (req, _p, m) => {
    let values: Record<string, unknown> = {};
    try { const form = await req.formData(); for (const [key, value] of form.entries()) values[key] = typeof value === "string" ? value : ""; }
    catch { try { values = await req.json() as Record<string, unknown>; } catch { values = {}; } }
    const transactionId = str(values.transactionId, 100), state = str(values.state, 20).toUpperCase(), amount = Number(values.amount);
    const match = /^(\d{5,10}|S\d{11,})$/.exec(transactionId);
    const internalId = match ? Number(transactionId.startsWith("S") ? transactionId.slice(1) : transactionId) : 0;
    const [pay] = internalId ? await db.select().from(payments).where(eq(payments.id, internalId)) : [];
    let result: { ok: boolean; paymentId: number | null; message: string };
    if (!pay || !pay.authority || !Number.isSafeInteger(amount)) result = { ok: false, paymentId: pay?.id ?? null, message: "اطلاعات بازگشت‌داده‌شده اسنپ‌پی معتبر نیست" };
    else result = await handleGatewayCallback(pay.authority, state, false, { ip: m.ip, ua: m.ua }, "snappay", transactionId, undefined, undefined, { transactionId, state, amount });
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", result.ok ? "1" : "0"); if (result.paymentId) url.searchParams.set("pid", String(result.paymentId)); url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "POST", pattern: "payments/behpardakht/callback", csrf: false, handler: async (req, _p, m) => {
    let fields: FormData;
    try { fields = await req.formData(); } catch { fields = new FormData(); }
    const authority = str(fields.get("RefId"), 100);
    const responseCode = str(fields.get("ResCode"), 20);
    const orderId = Number(fields.get("SaleOrderId"));
    const saleOrderId = Number(fields.get("SaleOrderId"));
    const saleReferenceId = Number(fields.get("SaleReferenceId"));
    const valid = !!authority && Number.isSafeInteger(orderId) && orderId > 0 && Number.isSafeInteger(saleOrderId) && saleOrderId > 0 && Number.isSafeInteger(saleReferenceId) && saleReferenceId >= 0;
    const result = valid
      ? await handleGatewayCallback(authority, responseCode, false, { ip: m.ip, ua: m.ua }, "behpardakht", undefined, undefined, undefined, undefined, { orderId, saleOrderId, saleReferenceId, responseCode })
      : { ok: false, paymentId: null, message: "اطلاعات بازگشت به‌پرداخت معتبر نیست" };
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", result.ok ? "1" : "0");
    if (result.paymentId) url.searchParams.set("pid", String(result.paymentId));
    url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "GET", pattern: "payments/vandar/callback", csrf: false, handler: async (req, _p, m) => {
    const q = req.nextUrl.searchParams, token = str(q.get("token"), 150), state = str(q.get("payment_status"), 20);
    const [pay] = token ? await db.select().from(payments).where(eq(payments.authority, token)) : [];
    const result = pay?.details.vandarInvoice ? await handleGatewayCallback(token, state, false, { ip: m.ip, ua: m.ua }, "vandar", undefined, undefined, undefined, undefined, undefined, { invoice: String(pay.details.vandarInvoice) }) : { ok: false, paymentId: pay?.id ?? null, message: "توکن بازگشت وندار معتبر نیست" };
    const url = new URL(`${baseUrl(req)}/pay/result`); url.searchParams.set("ok", result.ok ? "1" : "0"); if (result.paymentId) url.searchParams.set("pid", String(result.paymentId)); url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "POST", pattern: "payments/pasargad/callback", csrf: false, handler: async (req, _p, m) => {
    let values: Record<string, unknown> = {}; try { const form = await req.formData(); for (const [k,v] of form.entries()) values[k] = typeof v === "string" ? v : ""; } catch { try { values = await req.json() as Record<string,unknown>; } catch {} }
    const invoice = str(values.invoiceId ?? values.invoice ?? values.Invoice, 80), status = str(values.status ?? values.Status ?? values.state ?? values.State ?? "", 30);
    const [pay] = invoice ? await db.select().from(payments).where(eq(payments.id, Number(invoice))) : [];
    const urlId = String(pay?.details.pasargadUrlId ?? "");
    const result = pay?.details.pasargadInvoice === invoice && !!urlId && pay.authority === urlId
      ? await handleGatewayCallback(urlId, status, false, { ip: m.ip, ua: m.ua }, "pasargad", undefined, undefined, undefined, undefined, undefined, { invoice, urlId })
      : { ok: false, paymentId: pay?.id ?? null, message: "فاکتور یا شناسهٔ بازگشت پاسارگاد معتبر نیست" };
    const url = new URL(`${baseUrl(req)}/pay/result`); url.searchParams.set("ok", result.ok ? "1" : "0"); if (result.paymentId) url.searchParams.set("pid", String(result.paymentId)); url.searchParams.set("msg", result.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "GET", pattern: "payments/gateway-mode", handler: async () => ({ mode: zpMode() }) },
];
