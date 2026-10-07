const SERVICE_URL = "https://bpm.shaparak.ir/pgwchannel/services/pgw";
const PAYMENT_URL = "https://bpm.shaparak.ir/pgwchannel/startpay.mellat";
const SOAP_NS = "http://interfaces.core.sw.bps.com/";

export type BehpardakhtCredentials = { terminalId: string; username: string; password: string };
export type BehpardakhtTransaction = { orderId: number; saleOrderId: number; saleReferenceId: number };

function requireCredentials(c: BehpardakhtCredentials) {
  if (!/^\d+$/.test(c.terminalId.trim()) || !c.username.trim() || !c.password.trim()) {
    throw new Error("شناسه پایانه، نام کاربری یا رمز عبور به‌پرداخت در تنظیمات کامل نیست");
  }
}

function xml(value: string | number) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

async function soap(c: BehpardakhtCredentials, method: string, values: Record<string, string | number>) {
  requireCredentials(c);
  const args = Object.entries({ terminalId: c.terminalId.trim(), userName: c.username.trim(), userPassword: c.password, ...values })
    .map(([key, value]) => `<ns:${key}>${xml(value)}</ns:${key}>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${SOAP_NS}"><soap:Header/><soap:Body><ns:${method}>${args}</ns:${method}></soap:Body></soap:Envelope>`;
  let response: Response;
  try {
    response = await fetch(SERVICE_URL, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""', Accept: "text/xml" }, body, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new Error(`ارتباط با سرویس به‌پرداخت ناموفق بود: ${(error as Error).message || "خطای شبکه"}`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`سرویس به‌پرداخت پاسخ HTTP ${response.status} داد`);
  const fault = /<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i.exec(text);
  if (fault) throw new Error(`خطای SOAP به‌پرداخت: ${decodeXml(fault[1].replace(/<[^>]+>/g, "").trim())}`);
  const result = /<(?:\w+:)?return(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?return>/i.exec(text);
  if (!result) throw new Error("پاسخ سرویس به‌پرداخت قابل خواندن نیست");
  return decodeXml(result[1].replace(/<[^>]+>/g, "").trim());
}

function tehranDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "00";
  return { date: `${get("year")}${get("month")}${get("day")}`, time: `${get("hour")}${get("minute")}${get("second")}` };
}

export function behpardakhtOrderNumber(paymentId: number) {
  if (!Number.isSafeInteger(paymentId) || paymentId < 1 || paymentId > 9_999_999_999) throw new Error("شماره پرداخت برای درگاه به‌پرداخت معتبر نیست");
  return paymentId;
}

export async function behpardakhtCreatePayment(c: BehpardakhtCredentials, input: { paymentId: number; amountRial: number; callbackUrl: string; description: string }) {
  if (!Number.isSafeInteger(input.amountRial) || input.amountRial < 1 || input.amountRial > 9_999_999_999_999) throw new Error("مبلغ پرداخت به‌پرداخت نامعتبر است");
  let callback: URL;
  try { callback = new URL(input.callbackUrl); } catch { throw new Error("نشانی بازگشت به‌پرداخت معتبر نیست"); }
  if (callback.protocol !== "https:" || callback.username || callback.password) throw new Error("نشانی بازگشت به‌پرداخت باید HTTPS باشد");
  const orderId = behpardakhtOrderNumber(input.paymentId), { date, time } = tehranDateTime();
  const result = await soap(c, "bpPayRequest", { orderId, amount: input.amountRial, localDate: date, localTime: time, additionalData: input.description.slice(0, 500), callBackUrl: callback.toString(), payerId: 0 });
  const [code, refId] = result.split(",").map((x) => x.trim());
  if (code !== "0" || !refId || !/^[A-Za-z0-9]+$/.test(refId)) throw new Error(`ساخت درخواست پرداخت به‌پرداخت ناموفق بود${code ? ` (کد ${code})` : ""}`);
  return { orderId, refId, payUrl: `${PAYMENT_URL}?RefId=${encodeURIComponent(refId)}` };
}

export async function behpardakhtVerifyAndSettle(c: BehpardakhtCredentials, tx: BehpardakhtTransaction) {
  const keys = { orderId: tx.orderId, saleOrderId: tx.saleOrderId, saleReferenceId: tx.saleReferenceId };
  let verifyCode: string;
  try { verifyCode = await soap(c, "bpVerifyRequest", keys); }
  catch (error) {
    // The bank explicitly provides Inquiry to resolve an unknown Verify result.
    const inquiry = await soap(c, "bpInquiryRequest", keys);
    if (inquiry !== "0") throw error;
    verifyCode = "0";
  }
  if (verifyCode !== "0") {
    const inquiry = await soap(c, "bpInquiryRequest", keys);
    if (inquiry !== "0") throw new Error(`تأیید تراکنش به‌پرداخت ناموفق بود (کد ${verifyCode})`);
  }
  const settle = await soap(c, "bpSettleRequest", keys);
  if (settle !== "0") {
    // A zero inquiry response is the documented fallback proof if Settle's reply is lost/ambiguous.
    const inquiry = await soap(c, "bpInquiryRequest", keys);
    if (inquiry !== "0") throw new Error(`تسویه تراکنش به‌پرداخت ناموفق بود (کد ${settle})`);
  }
  return { orderId: tx.saleOrderId, referenceId: tx.saleReferenceId, settleCode: settle };
}

export async function behpardakhtReverse(c: BehpardakhtCredentials, tx: BehpardakhtTransaction) {
  const result = await soap(c, "bpReversalRequest", { orderId: tx.orderId, saleOrderId: tx.saleOrderId, saleReferenceId: tx.saleReferenceId });
  if (result !== "0") throw new Error(`برگشت تراکنش به‌پرداخت ناموفق بود (کد ${result})`);
}
