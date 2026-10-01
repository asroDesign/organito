/** Zibal IPG REST client. Amounts are sent in rial (project amounts are toman). */
export type ZibalMode = "live" | "sandbox";
export const zibalMode = (configuredMerchant?: string): ZibalMode => (configuredMerchant?.trim() || process.env.ZIBAL_MERCHANT?.trim()) ? "live" : "sandbox";
const merchant = (configuredMerchant?: string) => configuredMerchant?.trim() || process.env.ZIBAL_MERCHANT?.trim() || "zibal";
const endpoint = "https://gateway.zibal.ir/v1";

const messages: Record<number, string> = {
  100: "عملیات موفق", 102: "مرچنت یافت نشد", 103: "مرچنت غیرفعال است", 104: "مرچنت نامعتبر است",
  105: "مبلغ باید بیشتر از ۱٬۰۰۰ ریال باشد", 106: "آدرس بازگشت نامعتبر است", 201: "تراکنش قبلاً تأیید شده است",
  202: "تراکنش پرداخت‌نشده یا ناموفق است", 203: "شناسه تراکنش نامعتبر است",
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${endpoint}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { throw new Error(`پاسخ نامعتبر از زیبال (HTTP ${res.status})`); }
}

export async function zibalRequest(opts: { amountRial: number; callbackUrl: string; description: string; mobile?: string; orderId?: string; merchantId?: string }) {
  const data = await post<{ result: number; message?: string; trackId?: number }>("request", { merchant: merchant(opts.merchantId), amount: opts.amountRial, callbackUrl: opts.callbackUrl, description: opts.description.slice(0, 250), ...(opts.mobile ? { mobile: opts.mobile } : {}), ...(opts.orderId ? { orderId: opts.orderId } : {}) });
  if (data.result !== 100 || !data.trackId) throw new Error(messages[data.result] || data.message || `خطای درگاه زیبال (${data.result})`);
  return { authority: String(data.trackId), payUrl: `https://gateway.zibal.ir/start/${data.trackId}`, raw: data };
}

export type ZibalVerify = { ok: boolean; code: number; refId?: string; cardPan?: string; cardHash?: string; fee?: number; feeType?: string; message: string; raw: unknown };
export async function zibalVerify(trackId: string, amountRial: number, merchantId?: string): Promise<ZibalVerify> {
  const data = await post<{ result: number; message?: string; status?: number; amount?: number; refNumber?: number | string; cardNumber?: string; paidAt?: string }>("verify", { merchant: merchant(merchantId), trackId: Number(trackId) });
  const ok = [100, 201].includes(data.result) && data.status === 1 && Number(data.amount) === amountRial;
  return { ok, code: data.result, refId: data.refNumber ? String(data.refNumber) : undefined, cardPan: data.cardNumber, message: ok ? (data.result === 201 ? messages[201] : "پرداخت موفق") : Number(data.amount) !== amountRial && [100,201].includes(data.result) ? "مبلغ تأییدشده با سفارش برابر نیست" : messages[data.result] || data.message || `پرداخت ناموفق (${data.result})`, raw: data };
}
