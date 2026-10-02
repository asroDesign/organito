import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsLogs, smsTemplates, sellerSmsSettings } from "@/db/schema";
import { getSettings } from "./settings";
import { maskPhone } from "./util";

export const SMS_EVENTS: Record<string, { title: string; vars: string[]; body: string }> = {
  otp_login: { title: "کد ورود یک‌بارمصرف (OTP)", vars: ["code"], body: "کد ورود شما به سبزینه: {code}\nاین کد را در اختیار دیگران قرار ندهید." },
  order_created: { title: "ثبت سفارش", vars: ["name", "order"], body: "{name} عزیز، سفارش {order} ثبت شد. سبزینه" },
  payment_success: { title: "پرداخت موفق", vars: ["order", "amount"], body: "پرداخت سفارش {order} به مبلغ {amount} تومان موفق بود." },
  product_approved: { title: "تأیید محصول", vars: ["product"], body: "محصول {product} تأیید شد." },
  product_rejected: { title: "رد محصول", vars: ["product"], body: "محصول {product} رد شد. لطفاً پنل را بررسی کنید." },
  supply_quote_received: { title: "دریافت پیشنهاد تأمین", vars: ["request"], body: "پیشنهاد جدید برای درخواست {request} دریافت شد." },
  quotation_sent: { title: "صدور پیش‌فاکتور", vars: ["request", "amount"], body: "پیش‌فاکتور درخواست {request} به مبلغ {amount} تومان صادر شد." },
  ready_to_ship: { title: "آماده ارسال", vars: ["order"], body: "مرسوله سفارش {order} آماده ارسال است." },
  order_shipped: { title: "ارسال سفارش", vars: ["order", "tracking"], body: "سفارش {order} ارسال شد. کد رهگیری: {tracking}" },
  order_delivered: { title: "تحویل سفارش", vars: ["order"], body: "سفارش {order} تحویل شد. از خرید شما سپاسگزاریم." },
  ticket_reply: { title: "پاسخ تیکت", vars: ["ticket"], body: "به تیکت {ticket} پاسخ داده شد." },
  withdrawal_requested: { title: "ثبت برداشت", vars: ["amount"], body: "درخواست برداشت {amount} تومان ثبت شد." },
  birthday: { title: "تبریک تولد باشگاه مشتریان", vars: ["name"], body: "{name} عزیز، زادروزتان مبارک! از طرف خانواده سبزینه برایتان سلامتی و شادی آرزو می‌کنیم." },
  settlement_paid: { title: "پرداخت تسویه", vars: ["amount", "tracking"], body: "مبلغ {amount} تومان واریز شد. پیگیری: {tracking}" },
  cart_reminder: { title: "یادآوری سبد خرید ناتمام", vars: ["name", "url"], body: "{name} عزیز، سبد خرید شما در سبزینه هنوز تکمیل نشده است. برای ادامه خرید: {url}" },
  cart_discount: { title: "تخفیف تکمیل خرید", vars: ["name", "code", "url"], body: "{name} عزیز، برای تکمیل خریدتان کد تخفیف {code} را در سبزینه وارد کنید: {url}" },
};

export function renderTemplate(body: string, vars: Record<string, string | number>) {
  return body.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

function smsIrParameterName(name: string, mapping: string) {
  const pairs = mapping.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [variable, parameter] = pair.split(/[:=]/).map((part) => part.trim());
    if (variable === name && parameter) return parameter;
  }
  return name;
}

async function callProvider(provider: string, phone: string, patternId: string | null, body: string, vars: Record<string, string | number>, configuredKey = "", parameterMap = "") {
  if (provider === "kavenegar") {
    const key = configuredKey || process.env.KAVENEGAR_API_KEY;
    if (!key) return { ok: true, simulated: true, response: "simulated (no KAVENEGAR_API_KEY)" };
    const params = new URLSearchParams({ receptor: phone, template: patternId ?? "", token: String(Object.values(vars)[0] ?? "") });
    const r = await fetch(`https://api.kavenegar.com/v1/${key}/verify/lookup.json?${params}`, { signal: AbortSignal.timeout(8000) });
    return { ok: r.ok, simulated: false, response: (await r.text()).slice(0, 500) };
  }
  const key = configuredKey || process.env.SMSIR_API_KEY;
  if (!key) return { ok: true, simulated: true, response: "simulated (no SMSIR_API_KEY)" };
  if (!patternId || !/^\d+$/.test(patternId)) return { ok: false, simulated: false, response: "برای ارسال SMS.ir باید شناسه عددی قالب را در الگوی همین رویداد ثبت کنید" };
  const r = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "text/plain", "x-api-key": key },
    body: JSON.stringify({ mobile: phone, templateId: Number(patternId), parameters: Object.entries(vars).map(([name, value]) => ({ name: smsIrParameterName(name, parameterMap), value: String(value) })) }),
    signal: AbortSignal.timeout(8000),
  });
  return { ok: r.ok, simulated: false, response: (await r.text()).slice(0, 500) };
}

export function extractVars(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{(\w+)\}/g)).map((m) => m[1])));
}

async function deliver(event: string, phone: string, provider: string, patternId: string | null, body: string, vars: Record<string, string | number>, configuredKey = "", parameterMap = "") {
  let attempts = 0;
  let last = { ok: false, simulated: false, response: "" };
  while (attempts < 3) {
    attempts++;
    try {
      last = await callProvider(provider, phone, patternId, body, vars, configuredKey, parameterMap);
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
      body = renderTemplate(tpl.body, vars);
      out.push(await deliver(event, phone, s.smsProvider, tpl.patternId, body, vars, s.smsApiKey, s.smsirParameterMap));
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
    const st = await deliver(`manual:${tpl.event}`, phone, s.smsProvider, tpl.patternId, renderTemplate(tpl.body, vars), vars, s.smsApiKey, s.smsirParameterMap);
    if (st === "failed") failed++; else sent++;
  }
  return { sent, failed };
}

export async function retryLog(logId: number) {
  const [l] = await db.select().from(smsLogs).where(eq(smsLogs.id, logId));
  if (!l || l.status !== "failed" || !/^09\d{9}$/.test(l.phone)) return null;
  const s = await getSettings();
  return deliver(l.event, l.phone, s.smsProvider, null, l.body, {}, s.smsApiKey, s.smsirParameterMap);
}

export { maskPhone };

/** متن پیام باشگاه مشتریان را با پنل مستقل همان تأمین‌کننده ارسال و ثبت می‌کند. */
export async function sendDirectSms(event: string, phone: string, body: string, vars: Record<string, string | number> = {}): Promise<"sent" | "simulated" | "failed"> {
  const settings = await getSettings();
  const provider = settings.smsProvider;
  let status: "sent" | "simulated" | "failed" = "failed", response = "";
  try {
    if (provider === "kavenegar") {
      const key = settings.smsApiKey || process.env.KAVENEGAR_API_KEY;
      if (!key) { status = "simulated"; response = "کلید کاوه‌نگار تنظیم نشده؛ شبیه‌سازی شد"; }
      else {
        const r = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(key)}/sms/send.json`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ receptor: phone, message: body, ...(settings.smsSender ? { sender: settings.smsSender } : {}) }), signal: AbortSignal.timeout(10000), cache: "no-store" });
        response = (await r.text()).slice(0, 500); status = r.ok ? "sent" : "failed";
      }
    } else if (provider === "smsir") {
      const key = settings.smsApiKey || process.env.SMSIR_API_KEY;
      if (!key) { status = "simulated"; response = "کلید SMS.ir تنظیم نشده؛ شبیه‌سازی شد"; }
      else {
        const [eventTemplate] = event === "birthday" ? await db.select().from(smsTemplates).where(eq(smsTemplates.event, event)) : [];
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
  try { await db.insert(smsLogs).values({ event, phone, provider, body, status, response, attempts: 1 }); } catch {}
  return status;
}

export async function sendSellerClubSms(sellerId: number, phone: string, body: string): Promise<"sent" | "simulated" | "failed"> {
  const [config] = await db.select().from(sellerSmsSettings).where(eq(sellerSmsSettings.sellerId, sellerId));
  const provider = config?.provider ?? "simulate";
  let status: "sent" | "simulated" | "failed" = "failed", response = "";
  try {
    if (!config?.enabled) response = "پنل پیامک غیرفعال است";
    else if (provider === "simulate") { status = "simulated"; response = "شبیه‌سازی؛ پیام به سرویس بیرونی ارسال نشد"; }
    else if (!config.apiKey) response = "کلید API ثبت نشده است";
    else if (provider === "kavenegar") {
      const result = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(config.apiKey)}/sms/send.json`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ receptor: phone, message: body, ...(config.senderNumber ? { sender: config.senderNumber } : {}) }), signal: AbortSignal.timeout(10000), cache: "no-store" });
      response = (await result.text()).slice(0, 500); status = result.ok ? "sent" : "failed";
    } else if (provider === "smsir") {
      const result = await fetch("https://api.sms.ir/v1/send", { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": config.apiKey }, body: JSON.stringify({ lineNumber: Number((config.senderNumber ?? "").replace(/\D/g, "")) || 30007732000000, messageText: body, mobiles: [phone] }), signal: AbortSignal.timeout(10000), cache: "no-store" });
      response = (await result.text()).slice(0, 500);
      const parsed = (() => { try { return JSON.parse(response); } catch { return null; } })();
      status = result.ok && (parsed?.status === 1 || parsed?.status === 2) ? "sent" : "failed";
    } else response = "سرویس پیامک ناشناخته است";
  } catch (error) { response = (error as Error).message.slice(0, 500); }
  try { await db.insert(smsLogs).values({ event: `seller_club:${sellerId}`, phone, provider, body, status, response, attempts: 1 }); } catch {}
  return status;
}
