type VandarResponse = { status?: number; token?: string; amount?: string | number; transId?: string | number; refnumber?: string; trackingCode?: string; cardNumber?: string; errors?: string[]; message?: string };

async function call(path: string, body: Record<string, unknown>): Promise<VandarResponse> {
  const response = await fetch(`https://ipg.vandar.io/api/v3/${path}`, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  let result: VandarResponse;
  try { result = await response.json() as VandarResponse; } catch { throw new Error("پاسخ وندار قابل خواندن نیست"); }
  if (!response.ok || Number(result.status) !== 1) throw new Error(result.errors?.join("، ") || result.message || `خطای وندار (${response.status})`);
  return result;
}

export async function vandarCreate(apiKey: string, args: { amountRial: number; callbackUrl: string; mobile?: string; invoice: string; description: string }) {
  const result = await call("send", { api_key: apiKey, amount: args.amountRial, callback_url: args.callbackUrl, mobile_number: args.mobile, factorNumber: args.invoice, description: args.description.slice(0, 255) });
  if (!result.token) throw new Error("وند‌ار توکن پرداخت برنگرداند");
  return { token: result.token, payUrl: `https://ipg.vandar.io/v3/${encodeURIComponent(result.token)}` };
}

export async function vandarVerify(apiKey: string, token: string, expectedAmountRial: number, invoice: string) {
  const result = await call("verify", { api_key: apiKey, token });
  const paid = Math.round(Number(result.amount));
  if (paid !== expectedAmountRial || (result as VandarResponse & { factorNumber?: string }).factorNumber !== invoice) throw new Error("مبلغ یا شمارهٔ فاکتور تأییدشدهٔ وندار با پرداخت مطابقت ندارد");
  return { refId: String(result.transId ?? result.refnumber ?? ""), cardPan: result.cardNumber };
}
