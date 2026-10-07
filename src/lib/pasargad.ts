type P = { resultCode?: number; resultMsg?: string; token?: string; data?: { url?: string; urlId?: string; invoice?: string; amount?: number; referenceNumber?: string; maskedCardNumber?: string } };

async function post<T extends P>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(`https://pep.shaparak.ir/dorsa1/${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  let result: T;
  try { result = await response.json() as T; } catch { throw new Error("پاسخ درگاه پاسارگاد قابل خواندن نیست"); }
  if (!response.ok || Number(result.resultCode) !== 0) throw new Error(result.resultMsg || `خطای درگاه پاسارگاد (${response.status})`);
  return result;
}

export async function pasargadCreate(credentials: { username: string; password: string; terminalId: string }, args: { amountRial: number; invoice: string; callbackUrl: string; mobile?: string }) {
  const auth = await post<P>("token/getToken", { username: credentials.username, password: credentials.password });
  if (!auth.token) throw new Error("پاسارگاد توکن پذیرنده برنگرداند");
  const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", "-").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const sale = await post<P>("api/payment/purchase", { amount: args.amountRial, invoice: args.invoice, invoiceDate: date, serviceCode: 8, serviceType: "PURCHASE", callbackApi: args.callbackUrl, mobileNumber: args.mobile ?? "", terminalNumber: Number(credentials.terminalId) }, auth.token);
  if (!sale.data?.url || !sale.data.urlId) throw new Error("پاسارگاد نشانی پرداخت را برنگرداند");
  return { payUrl: sale.data.url, urlId: sale.data.urlId };
}

export async function pasargadConfirm(credentials: { username: string; password: string }, invoice: string, urlId: string, expectedAmountRial: number) {
  const auth = await post<P>("token/getToken", { username: credentials.username, password: credentials.password });
  if (!auth.token) throw new Error("پاسارگاد توکن پذیرنده برنگرداند");
  const result = await post<P>("api/payment/confirm-transactions", { invoice, urlId }, auth.token);
  if (result.data?.invoice !== invoice || Number(result.data?.amount) !== expectedAmountRial) throw new Error("مبلغ یا شمارهٔ فاکتور تأییدشدهٔ پاسارگاد با پرداخت مطابقت ندارد");
  return { refId: result.data.referenceNumber || result.data.urlId || invoice, cardPan: result.data.maskedCardNumber };
}
