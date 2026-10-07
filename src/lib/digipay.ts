type Credentials = { clientId: string; clientSecret: string; username: string; password: string; sandbox?: boolean };
type DigipayResult = { status?: number; message?: string; title?: string };
type TicketResponse = { result?: DigipayResult; ticket?: string; redirectUrl?: string };
type VerifyResponse = {
  result?: DigipayResult;
  trackingCode?: string;
  providerId?: string;
  amount?: number | string;
  paymentGateway?: number;
  rrn?: string;
  maskedPan?: string;
};

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const tokenRequests = new Map<string, Promise<string>>();

function apiBase(sandbox?: boolean) {
  return sandbox ? "https://uat.mydigipay.info/digipay/api" : "https://api.mydigipay.com/digipay/api";
}

function cacheKey(c: Credentials) {
  return `${c.sandbox ? "uat" : "live"}:${c.clientId}:${c.username}`;
}

async function parseResponse<T>(response: Response, description: string): Promise<T> {
  const raw = await response.text();
  let data: T;
  try { data = JSON.parse(raw) as T; }
  catch { throw new Error(`پاسخ نامعتبر از دیجی‌پی برای ${description} (HTTP ${response.status})`); }
  if (!response.ok) {
    const message = (data as { result?: DigipayResult })?.result?.message;
    throw new Error(message || `خطای دیجی‌پی برای ${description} (HTTP ${response.status})`);
  }
  return data;
}

async function accessToken(c: Credentials): Promise<string> {
  if (![c.clientId, c.clientSecret, c.username, c.password].every((x) => x.trim())) {
    throw new Error("اطلاعات پذیرنده دیجی‌پی در تنظیمات کامل نشده است");
  }
  const key = cacheKey(c), cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const pending = tokenRequests.get(key);
  if (pending) return pending;
  const request = (async () => {
    const form = new FormData();
    form.set("username", c.username.trim());
    form.set("password", c.password);
    form.set("grant_type", "password");
    const response = await fetch(`${apiBase(c.sandbox)}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${c.clientId.trim()}:${c.clientSecret}`).toString("base64")}`, Accept: "application/json" },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await parseResponse<{ access_token?: string; expires_in?: number }>(response, "دریافت توکن");
    if (!data.access_token) throw new Error("توکن دسترسی از دیجی‌پی دریافت نشد");
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000 });
    return data.access_token;
  })();
  tokenRequests.set(key, request);
  try { return await request; }
  finally { tokenRequests.delete(key); }
}

async function authenticatedPost<T>(c: Credentials, path: string, payload: unknown): Promise<T> {
  const token = await accessToken(c);
  const response = await fetch(`${apiBase(c.sandbox)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Agent: "WEB",
      "Digipay-Version": "2022-02-02",
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  return parseResponse<T>(response, path);
}

export function digipayAmount(amountToman: number, multiplier: number) {
  const amount = amountToman * multiplier;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("مبلغ ارسالی دیجی‌پی نامعتبر است");
  return amount;
}

export async function digipayCreateTicket(c: Credentials, input: { amount: number; phone: string; providerId: string; callbackUrl: string; preferredGateway?: number }) {
  const response = await authenticatedPost<TicketResponse>(c, "/tickets/business?type=11", {
    cellNumber: input.phone,
    amount: input.amount,
    providerId: input.providerId,
    callbackUrl: input.callbackUrl,
    ...(input.preferredGateway === undefined ? {} : { additionalInfo: { preferredGateway: input.preferredGateway } }),
  });
  if (Number(response.result?.status) !== 0 || !response.redirectUrl || !response.ticket) {
    throw new Error(response.result?.message || "ایجاد درخواست پرداخت دیجی‌پی موفق نبود");
  }
  return { redirectUrl: response.redirectUrl, ticket: response.ticket };
}

export async function digipayVerify(c: Credentials, input: { trackingCode: string; providerId: string; type: number }) {
  const response = await authenticatedPost<VerifyResponse>(c, `/purchases/verify?type=${encodeURIComponent(String(input.type))}`, {
    trackingCode: input.trackingCode,
    providerId: input.providerId,
  });
  return {
    ok: Number(response.result?.status) === 0,
    response,
    message: response.result?.message || "تأیید پرداخت دیجی‌پی ناموفق بود",
  };
}
