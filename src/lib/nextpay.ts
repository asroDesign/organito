/** NextPay's hosted payment gateway. Project amounts are stored in toman. */
const API = "https://api.nextpay.org/gateway";

async function post(path: "token.http" | "verify.http", values: Record<string, string | number>) {
  const response = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json, text/plain" },
    body: new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data: { code?: number | string; trans_id?: string; message?: string };
  try { data = JSON.parse(text) as typeof data; }
  catch { throw new Error(`پاسخ نامعتبر از نکست‌پی (HTTP ${response.status})`); }
  if (!response.ok) throw new Error(data.message || `خطای نکست‌پی (HTTP ${response.status})`);
  return data;
}

export async function nextPayRequest(opts: { apiKey: string; orderId: string; amountToman: number; callbackUrl: string }) {
  if (!opts.apiKey.trim()) throw new Error("کلید API نکست‌پی در تنظیمات وارد نشده است");
  if (!Number.isSafeInteger(opts.amountToman) || opts.amountToman < 100) throw new Error("مبلغ پرداخت نکست‌پی باید دست‌کم ۱۰۰ تومان باشد");
  const data = await post("token.http", { api_key: opts.apiKey.trim(), order_id: opts.orderId, amount: opts.amountToman, callback_uri: opts.callbackUrl });
  if (Number(data.code) !== -1 || !data.trans_id) throw new Error(data.message || `ساخت تراکنش نکست‌پی ناموفق بود (${data.code ?? "بدون کد"})`);
  return { authority: data.trans_id, payUrl: `${API}/payment/${encodeURIComponent(data.trans_id)}`, raw: data };
}

export async function nextPayVerify(opts: { apiKey: string; orderId: string; amountToman: number; transId: string }): Promise<{ ok: boolean; code: number; refId?: string; cardPan?: string; cardHash?: string; fee?: number; feeType?: string; message: string; raw: unknown }> {
  const data = await post("verify.http", { api_key: opts.apiKey.trim(), order_id: opts.orderId, amount: opts.amountToman, trans_id: opts.transId });
  const ok = Number(data.code) === 0;
  return { ok, code: Number(data.code), refId: opts.transId, message: ok ? "پرداخت نکست‌پی با موفقیت تأیید شد" : data.message || `تأیید پرداخت نکست‌پی ناموفق بود (${data.code ?? "بدون کد"})`, raw: data };
}
