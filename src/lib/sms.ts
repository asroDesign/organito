import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsLogs, smsTemplates, sellerSmsSettings } from "@/db/schema";
import { getSettings } from "./settings";
import { maskPhone } from "./util";
import { siteBrandText } from "./brand";
import { randomUUID } from "node:crypto";

export const SMS_EVENTS: Record<string, { title: string; vars: string[]; body: string }> = {
  otp_login: { title: "کد ورود یک‌بارمصرف (OTP)", vars: ["code"], body: "کد ورود شما: {code}\nاین کد را در اختیار دیگران قرار ندهید." },
  order_created: { title: "ثبت سفارش", vars: ["name", "order", "shop"], body: "{name} عزیز، سفارش {order} در {shop} ثبت شد." },
  payment_success: { title: "پرداخت موفق", vars: ["order", "amount"], body: "پرداخت سفارش {order} به مبلغ {amount} تومان موفق بود." },
  product_approved: { title: "تأیید محصول", vars: ["product"], body: "محصول {product} تأیید شد." },
  product_rejected: { title: "رد محصول", vars: ["product"], body: "محصول {product} رد شد. لطفاً پنل را بررسی کنید." },
  product_restock: { title: "موجودشدن محصول موردعلاقه", vars: ["product", "url", "unsubscribe"], body: "محصول {product} که پیگیرش بودید موجود شد: {url} — لغو اعلان: {unsubscribe}" },
  product_price_drop: { title: "کاهش قیمت محصول موردعلاقه", vars: ["product", "price", "url", "unsubscribe"], body: "قیمت {product} کاهش یافت و اکنون {price} است: {url} — لغو اعلان: {unsubscribe}" },
  supply_quote_received: { title: "دریافت پیشنهاد تأمین", vars: ["request"], body: "پیشنهاد جدید برای درخواست {request} دریافت شد." },
  quotation_sent: { title: "صدور پیش‌فاکتور", vars: ["request", "amount"], body: "پیش‌فاکتور درخواست {request} به مبلغ {amount} تومان صادر شد." },
  ready_to_ship: { title: "آماده ارسال", vars: ["order"], body: "مرسوله سفارش {order} آماده ارسال است." },
  order_shipped: { title: "ارسال سفارش", vars: ["order", "tracking"], body: "سفارش {order} ارسال شد. کد رهگیری: {tracking}" },
  order_delivered: { title: "تحویل سفارش", vars: ["order"], body: "سفارش {order} تحویل شد. از خرید شما سپاسگزاریم." },
  ticket_reply: { title: "پاسخ تیکت", vars: ["ticket"], body: "به تیکت {ticket} پاسخ داده شد." },
  withdrawal_requested: { title: "ثبت برداشت", vars: ["amount"], body: "درخواست برداشت {amount} تومان ثبت شد." },
  birthday: { title: "تبریک تولد باشگاه مشتریان", vars: ["name", "shop"], body: "{name} عزیز، زادروزتان مبارک! از طرف خانواده {shop} برایتان سلامتی و شادی آرزو می‌کنیم." },
  settlement_paid: { title: "پرداخت تسویه", vars: ["amount", "tracking"], body: "مبلغ {amount} تومان واریز شد. پیگیری: {tracking}" },
  cart_reminder: { title: "یادآوری سبد خرید ناتمام", vars: ["name", "url", "shop"], body: "{name} عزیز، سبد خرید شما در {shop} هنوز تکمیل نشده است. برای ادامه خرید: {url}" },
  cart_discount: { title: "تخفیف تکمیل خرید", vars: ["name", "code", "url", "shop"], body: "{name} عزیز، برای تکمیل خریدتان کد تخفیف {code} را در {shop} وارد کنید: {url}" },
};

export function renderTemplate(body: string, vars: Record<string, string | number>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g, (match, doubleKey, singleKey) => { const k = doubleKey ?? singleKey; return vars[k] !== undefined ? String(vars[k]) : match; });
}

function smsIrParameterName(name: string, mapping: string) {
  const pairs = mapping.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [variable, parameter] = pair.split(/[:=]/).map((part) => part.trim());
    if (variable === name && parameter) return parameter;
  }
  return name;
}

function normalizeParameterMap(value: string | Record<string, string>) {
  if (typeof value !== "string") return value;
  try { const parsed = JSON.parse(value); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>; } catch {}
  const pairs = value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  return Object.fromEntries(pairs.map((pair) => pair.split(/[:=]/).map((part) => part.trim())).filter(([k, v]) => !!k && !!v));
}

function mappedParameters(vars: Record<string, string | number>, parameterMap: string | Record<string, string>) {
  const mapping = normalizeParameterMap(parameterMap);
  return Object.fromEntries(Object.entries(vars).map(([name, value]) => [mapping[name] || name, String(value)]));
}

function ippanelPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^00989\d{9}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^989\d{9}$/.test(digits)) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

async function callIppanel(phone: string, patternId: string | null, body: string, vars: Record<string, string | number>, apiKey: string, parameterMap: string | Record<string, string>, senderNumber: string) {
  if (!apiKey) return { ok: true, simulated: true, response: "simulated (no IPPANEL_API_KEY)" };
  if (!senderNumber) return { ok: false, simulated: false, response: "شماره خط معتبر ippanel ثبت نشده است" };
  const payload = patternId
    ? { sending_type: "pattern", from_number: senderNumber, code: patternId, recipients: [ippanelPhone(phone)], params: mappedParameters(vars, parameterMap) }
    : { sending_type: "webservice", from_number: senderNumber, message: body, params: { recipients: [ippanelPhone(phone)] } };
  const r = await fetch("https://edge.ippanel.com/v1/api/send", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: apiKey },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000), cache: "no-store",
  });
  const response = (await r.text()).slice(0, 500);
  const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
  const ok = r.ok && parsed?.meta?.status === true;
  const detail = response || `HTTP ${r.status}`;
  return { ok, simulated: false, response: detail };
}

async function callProvider(provider: string, phone: string, patternId: string | null, body: string, vars: Record<string, string | number>, configuredKey = "", parameterMap: string | Record<string, string> = "", clientReferenceId = randomUUID(), senderNumber = "", configuredUsername = "") {
  if (provider === "ippanel") return callIppanel(phone, patternId, body, vars, configuredKey || process.env.IPPANEL_API_KEY || "", parameterMap, senderNumber || process.env.IPPANEL_SENDER_NUMBER || "");
  if (provider === "mediana") {
    const key = configuredKey || process.env.MEDIANA_API_KEY;
    if (!key) return { ok: true, simulated: true, response: "simulated (no MEDIANA_API_KEY)" };
    if (patternId) {
      const r = await fetch("https://api.mediana.ir/sms/v1/send/pattern", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": key },
        body: JSON.stringify({ ...(senderNumber ? { sendingNumber: senderNumber } : { type: "Informational" }), recipients: [phone], patternCode: patternId, parameters: mappedParameters(vars, parameterMap) }),
        signal: AbortSignal.timeout(10000), cache: "no-store",
      });
      const response = (await r.text()).slice(0, 500);
      const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
      const apiCode = String(parsed?.meta?.code ?? "");
      const ok = r.ok && (!apiCode || apiCode.toLowerCase() === "ok") && parsed?.data?.succeed !== false;
      return { ok, simulated: false, response: response || `HTTP ${r.status}${ok ? " (accepted)" : ""}` };
    }
    const r = await fetch("https://api.mediana.ir/sms/v1/send/sms", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": key },
      body: JSON.stringify({ ...(senderNumber ? { sendingNumber: senderNumber } : { type: "Informational" }), recipients: [phone], messageText: body }),
      signal: AbortSignal.timeout(10000), cache: "no-store",
    });
    const response = (await r.text()).slice(0, 500);
    const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
    const apiCode = String(parsed?.meta?.code ?? "");
    const ok = r.ok && (!apiCode || apiCode.toLowerCase() === "ok") && parsed?.data?.succeed !== false;
    return { ok, simulated: false, response: response || `HTTP ${r.status}${ok ? " (accepted)" : ""}` };
  }
  if (provider === "melipayamak") {
    const username = configuredUsername || process.env.MELIPAYAMAK_USERNAME || "";
    const password = configuredKey || process.env.MELIPAYAMAK_PASSWORD || "";
    if (!username || !password) return { ok: true, simulated: true, response: "simulated (missing MELIPAYAMAK_USERNAME or MELIPAYAMAK_PASSWORD)" };
    if (patternId) {
      if (!/^\d+$/.test(patternId)) return { ok: false, simulated: false, response: "شناسه الگوی ملی‌پیامک باید عددی باشد" };
      const mapping = normalizeParameterMap(parameterMap);
      const ordered = Object.entries(vars).sort(([a], [b]) => Number(mapping[a] || 999) - Number(mapping[b] || 999));
      const text = ordered.map(([, value]) => String(value)).join(";");
      const r = await fetch("https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ username, password, to: phone, bodyId: patternId, text }),
        signal: AbortSignal.timeout(10000), cache: "no-store",
      });
      const response = (await r.text()).slice(0, 500);
      const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
      const recId = Number(parsed?.Value ?? parsed?.value ?? response);
      return { ok: r.ok && Number.isFinite(recId) && recId > 0, simulated: false, response };
    }
    const r = await fetch("https://rest.payamak-panel.com/api/SendSMS/SendSMS", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ username, password, to: phone, from: senderNumber, text: body, isFlash: "false" }),
      signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    const response = (await r.text()).slice(0, 500);
    const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
    const retStatus = Number(parsed?.RetStatus ?? parsed?.retStatus);
    const messageId = Number(parsed?.Value ?? parsed?.value);
    return { ok: r.ok && (retStatus === 1 || (retStatus === 0 && messageId > 0)), simulated: false, response };
  }
  if (provider === "ghasedak") {
    const key = configuredKey || process.env.GHASEDAK_API_KEY;
    if (!key) return { ok: true, simulated: true, response: "simulated (no GHASEDAK_API_KEY)" };
    if (patternId) {
      const mapped = mappedParameters(vars, parameterMap);
      const params = Object.fromEntries(Object.entries(mapped).map(([name, value]) => {
        const key = /^param\d+$/i.test(name) ? name.toLowerCase() : "";
        return [key, value];
      }).filter(([name]) => !!name));
      if (!Object.keys(params).length) return { ok: false, simulated: false, response: "برای الگوی قاصدک، نام هر متغیر را به param1 تا param10 نگاشت کنید" };
      const r = await fetch("https://gateway.ghasedak.me/rest/api/v1/WebService/SendOtpWithParams", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ApiKey: key },
        body: JSON.stringify({ receptors: [phone], templateName: patternId, clientReferenceId, ...params }),
        signal: AbortSignal.timeout(10000), cache: "no-store",
      });
      const response = (await r.text()).slice(0, 500);
      const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
      return { ok: r.ok && (parsed?.IsSuccess === true || parsed?.isSuccess === true), simulated: false, response };
    }
    const r = await fetch("https://gateway.ghasedak.me/rest/api/v1/WebService/SendSingleSMS", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ApiKey: key },
      body: JSON.stringify({ ...((senderNumber || process.env.GHASEDAK_LINE_NUMBER) ? { lineNumber: senderNumber || process.env.GHASEDAK_LINE_NUMBER } : {}), receptor: phone, message: body, clientReferenceId, udh: true }),
      signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    const response = (await r.text()).slice(0, 500);
    const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
    return { ok: r.ok && (parsed?.IsSuccess === true || parsed?.isSuccess === true) && Number(parsed?.StatusCode ?? parsed?.statusCode) === 200, simulated: false, response };
  }
  if (provider === "kavenegar") {
    const key = configuredKey || process.env.KAVENEGAR_API_KEY;
    if (!key) return { ok: true, simulated: true, response: "simulated (no KAVENEGAR_API_KEY)" };
    if (!patternId) return { ok: false, simulated: false, response: "برای کاوه‌نگار شناسه الگوی lookup الزامی است" };
    const mapped = mappedParameters(vars, parameterMap);
    const params = new URLSearchParams({ receptor: phone, template: patternId, ...mapped });
    const r = await fetch(`https://api.kavenegar.com/v1/${key}/verify/lookup.json?${params}`, { signal: AbortSignal.timeout(8000) });
    const response = (await r.text()).slice(0, 500);
    const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
    return { ok: r.ok && Number(parsed?.return?.status) === 200, simulated: false, response };
  }
  const key = configuredKey || process.env.SMSIR_API_KEY;
  if (!key) return { ok: true, simulated: true, response: "simulated (no SMSIR_API_KEY)" };
  if (!patternId || !/^\d+$/.test(patternId)) return { ok: false, simulated: false, response: "برای ارسال SMS.ir باید شناسه عددی قالب را در الگوی همین رویداد ثبت کنید" };
  const r = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "text/plain", "x-api-key": key },
    body: JSON.stringify({ mobile: phone, templateId: Number(patternId), parameters: Object.entries(vars).map(([name, value]) => ({ name: normalizeParameterMap(parameterMap)[name] || smsIrParameterName(name, ""), value: String(value) })) }),
    signal: AbortSignal.timeout(8000),
  });
  return { ok: r.ok, simulated: false, response: (await r.text()).slice(0, 500) };
}

export function extractVars(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{(\w+)\}/g)).map((m) => m[1])));
}

async function deliver(event: string, phone: string, provider: string, patternId: string | null, body: string, vars: Record<string, string | number>, configuredKey = "", parameterMap: string | Record<string, string> = "", senderNumber = "", configuredUsername = "") {
  let attempts = 0;
  const clientReferenceId = randomUUID();
  let last = { ok: false, simulated: false, response: "" };
  while (attempts < 3) {
    attempts++;
    try {
      last = await callProvider(provider, phone, patternId, body, vars, configuredKey, parameterMap, clientReferenceId, senderNumber, configuredUsername);
      if (last.ok) break;
    } catch (e) {
      last = { ok: false, simulated: false, response: (e as Error).message };
    }
    await new Promise((r) => setTimeout(r, 200 * attempts));
  }
  const status = last.ok ? (last.simulated ? "simulated" : "sent") : "failed";
  const logBody = event.startsWith("otp") ? body.replace(/\d{4,6}/g, "*****") : body;
  await db.insert(smsLogs).values({ event, phone, provider, body: logBody, status, response: last.response, attempts });
  return status;
}

/** Sends every active template registered for an event (multiple patterns per event supported). */
export async function sendSms(event: string, phone: string, vars: Record<string, string | number>, force = false, templateId?: number) {
  try {
    const all = await db.select().from(smsTemplates).where(eq(smsTemplates.event, event));
    const tpls = all.filter((t) => (templateId ? t.id === templateId : true) && (t.isActive || force));
    if (!tpls.length) return { status: "skipped" };
    const s = await getSettings();
    const out: string[] = [];
    let body = "";
    for (const tpl of tpls) {
      const dynamicVars: Record<string, string | number> = { ...vars, shop: s.siteName };
      body = siteBrandText(renderTemplate(tpl.body, dynamicVars), s.siteName);
      const patternVars = Object.fromEntries(tpl.variables.filter((name) => dynamicVars[name] !== undefined).map((name) => [name, dynamicVars[name]]));
      out.push(await deliver(event, phone, s.smsProvider, tpl.patternId, body, patternVars, s.smsProvider === "melipayamak" ? s.smsPassword : s.smsApiKey, { ...normalizeParameterMap(s.smsirParameterMap), ...(tpl.parameterMap ?? {}) }, s.smsSender, s.smsUsername));
    }
    return { status: out.join(","), body };
  } catch {
    return { status: "error" };
  }
}

export async function sendTemplateTo(templateId: number, phones: string[], vars: Record<string, string | number>) {
  const [tpl] = await db.select().from(smsTemplates).where(eq(smsTemplates.id, templateId));
  if (!tpl) return { sent: 0, failed: 0 };
  const s = await getSettings();
  let sent = 0, failed = 0;
  for (const phone of phones) {
    const dynamicVars: Record<string, string | number> = { ...vars, shop: s.siteName };
    const patternVars = Object.fromEntries(tpl.variables.filter((name) => dynamicVars[name] !== undefined).map((name) => [name, dynamicVars[name]]));
    const st = await deliver(`manual:${tpl.event}`, phone, s.smsProvider, tpl.patternId, siteBrandText(renderTemplate(tpl.body, dynamicVars), s.siteName), patternVars, s.smsProvider === "melipayamak" ? s.smsPassword : s.smsApiKey, { ...normalizeParameterMap(s.smsirParameterMap), ...(tpl.parameterMap ?? {}) }, s.smsSender, s.smsUsername);
    if (st === "failed") failed++; else sent++;
  }
  return { sent, failed };
}

export async function retryLog(logId: number) {
  const [l] = await db.select().from(smsLogs).where(eq(smsLogs.id, logId));
  if (!l || l.status !== "failed" || !/^09\d{9}$/.test(l.phone)) return null;
  const s = await getSettings();
  return deliver(l.event, l.phone, s.smsProvider, null, siteBrandText(l.body, s.siteName), {}, s.smsProvider === "melipayamak" ? s.smsPassword : s.smsApiKey, s.smsirParameterMap, s.smsSender, s.smsUsername);
}

export { maskPhone };

/** متن پیام باشگاه مشتریان را با پنل مستقل همان تأمین‌کننده ارسال و ثبت می‌کند. */
export async function sendDirectSms(event: string, phone: string, body: string, vars: Record<string, string | number> = {}): Promise<"sent" | "simulated" | "failed"> {
  const settings = await getSettings();
  body = renderTemplate(body, { ...vars, shop: settings.siteName });
  body = siteBrandText(body, settings.siteName);
  const provider = settings.smsProvider;
  const [eventTemplate] = await db.select().from(smsTemplates).where(eq(smsTemplates.event, event));
  if (eventTemplate?.isActive && eventTemplate.patternId) {
    const dynamicVars: Record<string, string | number> = { ...vars, shop: settings.siteName };
    const patternVars = Object.fromEntries(eventTemplate.variables.filter((name) => dynamicVars[name] !== undefined).map((name) => [name, dynamicVars[name]]));
    const result = await deliver(event, phone, provider, eventTemplate.patternId, body, patternVars, provider === "melipayamak" ? settings.smsPassword : settings.smsApiKey, { ...normalizeParameterMap(settings.smsirParameterMap), ...(eventTemplate.parameterMap ?? {}) }, settings.smsSender, settings.smsUsername);
    return result;
  }
  let status: "sent" | "simulated" | "failed" = "failed", response = "";
  try {
    if (provider === "kavenegar") {
      const key = settings.smsApiKey || process.env.KAVENEGAR_API_KEY;
      if (!key) { status = "simulated"; response = "کلید کاوه‌نگار تنظیم نشده؛ شبیه‌سازی شد"; }
      else {
        const r = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(key)}/sms/send.json`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ receptor: phone, message: body, ...(settings.smsSender ? { sender: settings.smsSender } : {}) }), signal: AbortSignal.timeout(10000), cache: "no-store" });
        response = (await r.text()).slice(0, 500); status = r.ok ? "sent" : "failed";
      }
    } else if (provider === "ghasedak") {
      const key = settings.smsApiKey || process.env.GHASEDAK_API_KEY;
      if (!key) { status = "simulated"; response = "کلید قاصدک تنظیم نشده؛ شبیه‌سازی شد"; }
      else {
        const result = await callProvider("ghasedak", phone, null, body, {}, key, "", randomUUID(), settings.smsSender);
        response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
      }
    } else if (provider === "mediana") {
      const result = await callProvider("mediana", phone, null, body, {}, settings.smsApiKey || process.env.MEDIANA_API_KEY || "", "", randomUUID(), settings.smsSender);
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else if (provider === "ippanel") {
      const result = await callIppanel(phone, null, body, {}, settings.smsApiKey || process.env.IPPANEL_API_KEY || "", "", settings.smsSender || process.env.IPPANEL_SENDER_NUMBER || "");
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else if (provider === "melipayamak") {
      const result = await callProvider("melipayamak", phone, null, body, {}, settings.smsPassword, "", randomUUID(), settings.smsSender, settings.smsUsername);
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else if (provider === "smsir") {
      const key = settings.smsApiKey || process.env.SMSIR_API_KEY;
      if (!key) { status = "simulated"; response = "کلید SMS.ir تنظیم نشده؛ شبیه‌سازی شد"; }
      else {
        if (eventTemplate?.isActive && eventTemplate.patternId && /^\d+$/.test(eventTemplate.patternId)) {
          const parameterNames = extractVars(eventTemplate.body);
          const templateVars = Object.fromEntries(parameterNames.filter((name) => vars[name] !== undefined).map((name) => [name, vars[name]]));
          const result = await callProvider("smsir", phone, eventTemplate.patternId, body, templateVars, key, settings.smsirParameterMap);
          response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
        } else {
          const r = await fetch("https://api.sms.ir/v1/send", { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": key }, body: JSON.stringify({ lineNumber: Number((settings.smsSender ?? "").replace(/\D/g, "")) || 30007732000000, messageText: body, mobiles: [phone] }), signal: AbortSignal.timeout(10000), cache: "no-store" });
          response = (await r.text()).slice(0, 500); const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })(); status = r.ok && (parsed?.status === 1 || parsed?.status === 2) ? "sent" : "failed";
        }
      }
    } else response = "سرویس پیامک ناشناخته است";
  } catch (error) { response = (error as Error).message.slice(0, 500); }
  const logBody = event.startsWith("otp") ? body.replace(/\d{4,6}/g, "*****") : body;
  try { await db.insert(smsLogs).values({ event, phone, provider, body: logBody, status, response, attempts: 1 }); } catch {}
  return status;
}

export async function sendSellerClubSms(sellerId: number, phone: string, body: string): Promise<"sent" | "simulated" | "failed"> {
  const [config] = await db.select().from(sellerSmsSettings).where(eq(sellerSmsSettings.sellerId, sellerId));
  const provider = config?.provider ?? "simulate";
  const configuredApiKey = config?.apiKey ?? "", configuredUsername = config?.username ?? "", configuredPassword = config?.password ?? "", senderNumber = config?.senderNumber ?? "";
  let status: "sent" | "simulated" | "failed" = "failed", response = "";
  try {
    if (!config?.enabled) response = "پنل پیامک غیرفعال است";
    else if (provider === "simulate") { status = "simulated"; response = "شبیه‌سازی؛ پیام به سرویس بیرونی ارسال نشد"; }
    else if (provider === "melipayamak" && (!configuredUsername || !configuredPassword)) response = "نام کاربری یا رمز ملی‌پیامک ثبت نشده است";
    else if (provider !== "melipayamak" && !configuredApiKey) response = "کلید API ثبت نشده است";
    else if (provider === "kavenegar") {
      const result = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(configuredApiKey)}/sms/send.json`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ receptor: phone, message: body, ...(senderNumber ? { sender: senderNumber } : {}) }), signal: AbortSignal.timeout(10000), cache: "no-store" });
      response = (await result.text()).slice(0, 500); status = result.ok ? "sent" : "failed";
    } else if (provider === "ghasedak") {
      const result = await callProvider("ghasedak", phone, null, body, {}, configuredApiKey, "", randomUUID(), senderNumber);
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else if (provider === "mediana") {
      const result = await callProvider("mediana", phone, null, body, {}, config.apiKey ?? "", "", randomUUID(), config.senderNumber ?? "");
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else if (provider === "melipayamak") {
      const result = await callProvider("melipayamak", phone, null, body, {}, configuredPassword, "", randomUUID(), senderNumber, configuredUsername);
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else if (provider === "smsir") {
      const result = await fetch("https://api.sms.ir/v1/send", { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": configuredApiKey }, body: JSON.stringify({ lineNumber: Number(senderNumber.replace(/\D/g, "")) || 30007732000000, messageText: body, mobiles: [phone] }), signal: AbortSignal.timeout(10000), cache: "no-store" });
      response = (await result.text()).slice(0, 500);
      const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
      status = result.ok && (parsed?.status === 1 || parsed?.status === 2) ? "sent" : "failed";
    } else if (provider === "ippanel") {
      const result = await callIppanel(phone, null, body, {}, configuredApiKey, "", senderNumber);
      response = result.response; status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";
    } else response = "سرویس پیامک ناشناخته است";
  } catch (error) { response = (error as Error).message.slice(0, 500); }
  try { await db.insert(smsLogs).values({ event: `seller_club:${sellerId}`, phone, provider, body, status, response, attempts: 1 }); } catch {}
  return status;
}
