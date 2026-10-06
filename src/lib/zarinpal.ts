/**
 * Zarinpal Payment Gateway v4 client.
 * Docs: https://www.zarinpal.com/docs/paymentGateway/connectToGateway.html
 *
 * Env:
 *   ZARINPAL_MERCHANT_ID  36-char merchant id (required for real payments)
 *   ZARINPAL_SANDBOX      "true" to use sandbox.zarinpal.com
 * Without a merchant id, the built-in simulator (/pay/simulate) is used so the full flow can be tested.
 * Amounts are sent in RIAL (toman × 10), the Zarinpal default.
 */
export type ZpMode = "live" | "sandbox" | "simulator";

export function zpMode(configuredMerchant?: string, sandbox?: boolean): ZpMode {
  const id = configuredMerchant?.trim() || process.env.ZARINPAL_MERCHANT_ID?.trim();
  if (!id) return "simulator";
  return (sandbox ?? (process.env.ZARINPAL_SANDBOX === "true")) ? "sandbox" : "live";
}
const host = (configuredMerchant?: string, sandbox?: boolean) => (zpMode(configuredMerchant, sandbox) === "sandbox" ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com");

export const ZP_ERRORS: Record<number, string> = {
  [-9]: "خطای اعتبارسنجی اطلاعات ارسالی", [-10]: "آی‌پی یا مرچنت کد پذیرنده صحیح نیست", [-11]: "مرچنت کد فعال نیست",
  [-12]: "تلاش بیش از حد در یک بازه زمانی کوتاه", [-15]: "درگاه پرداخت به حالت تعلیق درآمده است", [-16]: "سطح تأیید پذیرنده پایین‌تر از سطح نقره‌ای است",
  [-30]: "اجازه دسترسی به تسویه اشتراکی شناور ندارید", [-31]: "حساب بانکی تسویه به پنل اضافه نشده است", [-33]: "مبلغ وارد شده از سقف مجاز بیشتر است",
  [-50]: "مبلغ پرداخت‌شده با مقدار مبلغ در وریفای متفاوت است", [-51]: "پرداخت ناموفق", [-52]: "خطای غیرمنتظره", [-53]: "اتوریتی برای این مرچنت کد نیست",
  [-54]: "اتوریتی نامعتبر است", [-55]: "تراکنش مورد نظر یافت نشد",
};

async function post<T>(path: string, body: Record<string, unknown>, base = host()): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  const text = await r.text();
  try { return JSON.parse(text) as T; } catch { throw new Error(`پاسخ نامعتبر از زرین‌پال (HTTP ${r.status})`); }
}

type ZpResp<D> = { data: D | []; errors: { code?: number; message?: string } | [] };

export async function zpRequest(opts: { amountRial: number; callbackUrl: string; description: string; mobile?: string; email?: string; orderId?: string; merchantId?: string; sandbox?: boolean }) {
  if (zpMode(opts.merchantId, opts.sandbox) === "simulator") {
    const authority = `SIM${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 10).toUpperCase()}`.padEnd(36, "0").slice(0, 36);
    return { authority, payUrl: `/pay/simulate/${authority}`, raw: { simulated: true } };
  }
  const res = await post<ZpResp<{ code: number; authority: string; message: string }>>("/pg/v4/payment/request.json", {
    merchant_id: opts.merchantId?.trim() || process.env.ZARINPAL_MERCHANT_ID, amount: opts.amountRial, callback_url: opts.callbackUrl, description: opts.description.slice(0, 250),
    metadata: { ...(opts.mobile ? { mobile: opts.mobile } : {}), ...(opts.email ? { email: opts.email } : {}), ...(opts.orderId ? { order_id: opts.orderId } : {}) },
  }, host(opts.merchantId, opts.sandbox));
  const d = res.data as { code?: number; authority?: string };
  if (!d || d.code !== 100 || !d.authority) {
    const code = (res.errors as { code?: number })?.code ?? d?.code ?? 0;
    throw new Error(ZP_ERRORS[code] ?? `خطای درگاه زرین‌پال (${code})`);
  }
  return { authority: d.authority, payUrl: `${host(opts.merchantId, opts.sandbox)}/pg/StartPay/${d.authority}`, raw: res };
}

export type ZpVerify = { ok: boolean; code: number; refId?: string; cardPan?: string; cardHash?: string; fee?: number; feeType?: string; message: string; raw: unknown };

export async function zpVerify(authority: string, amountRial: number, simulatedOk?: boolean, configuredMerchant?: string, sandbox?: boolean): Promise<ZpVerify> {
  if (zpMode(configuredMerchant, sandbox) === "simulator") {
    return simulatedOk
      ? { ok: true, code: 100, refId: String(Date.now()).slice(-10), cardPan: `603799******${String(1000 + Math.floor(Math.random() * 9000))}`, fee: 0, message: "پرداخت آزمایشی موفق", raw: { simulated: true } }
      : { ok: false, code: -51, message: "پرداخت آزمایشی ناموفق", raw: { simulated: true } };
  }
  const res = await post<ZpResp<{ code: number; ref_id: number; card_pan: string; card_hash: string; fee_type: string; fee: number; message: string }>>("/pg/v4/payment/verify.json", {
    merchant_id: configuredMerchant?.trim() || process.env.ZARINPAL_MERCHANT_ID, amount: amountRial, authority,
  }, host(configuredMerchant, sandbox));
  const d = res.data as { code?: number; ref_id?: number; card_pan?: string; card_hash?: string; fee_type?: string; fee?: number };
  const code = d?.code ?? (res.errors as { code?: number })?.code ?? 0;
  if (code === 100 || code === 101) {
    return { ok: true, code, refId: String(d.ref_id ?? ""), cardPan: d.card_pan, cardHash: d.card_hash, fee: d.fee, feeType: d.fee_type, message: code === 101 ? "تراکنش قبلاً تأیید شده است" : "پرداخت موفق", raw: res };
  }
  return { ok: false, code, message: ZP_ERRORS[code] ?? `پرداخت ناموفق (${code})`, raw: res };
}
