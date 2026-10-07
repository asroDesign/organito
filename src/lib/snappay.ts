type Credentials = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

type SnapResponse<T> = { successful?: boolean; response?: T; errorData?: { message?: string; errorCode?: number } };
type SnapToken = { paymentToken?: string; paymentPageUrl?: string };
type SnapEligibility = { eligible?: boolean; title_message?: string; description?: string };

function normalizedBase(value: string) {
  const raw = value.trim().replace(/\/+$/, "");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("نشانی API اسنپ‌پی در تنظیمات معتبر نیست"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("نشانی API اسنپ‌پی باید دامنهٔ HTTPS بدون مسیر یا اطلاعات ورود باشد");
  }
  return url.origin;
}

async function jsonRequest<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(25_000) }); }
  catch (error) { throw new Error(`${label}: ${(error as Error).message || "ارتباط برقرار نشد"}`); }
  let data: SnapResponse<T>;
  try { data = await response.json() as SnapResponse<T>; }
  catch { throw new Error(`${label}: پاسخ JSON معتبر از اسنپ‌پی دریافت نشد`); }
  if (!response.ok || data.successful === false || !data.response) {
    throw new Error(`${label}: ${data.errorData?.message || `خطای HTTP ${response.status}`}`);
  }
  return data.response;
}

async function accessToken(credentials: Credentials) {
  const base = normalizedBase(credentials.baseUrl);
  if (![credentials.clientId, credentials.clientSecret, credentials.username, credentials.password].every((x) => x.trim())) {
    throw new Error("اطلاعات API اسنپ‌پی در تنظیمات کامل نشده است");
  }
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "password", scope: "online-merchant", username: credentials.username, password: credentials.password });
  let response: Response;
  try {
    response = await fetch(`${base}/api/online/v1/oauth/token`, {
      method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body, cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
  } catch (error) { throw new Error(`دریافت دسترسی اسنپ‌پی ناموفق بود: ${(error as Error).message}`); }
  const data = await response.json().catch(() => null) as { access_token?: string; error_description?: string } | null;
  if (!response.ok || !data?.access_token) throw new Error(`دریافت دسترسی اسنپ‌پی ناموفق بود: ${data?.error_description || `خطای HTTP ${response.status}`}`);
  return { base, token: data.access_token };
}

async function request<T>(credentials: Credentials, path: string, method: "GET" | "POST", body?: unknown, query?: Record<string, string>) {
  const { base, token } = await accessToken(credentials);
  const url = new URL(`${base}${path}`);
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const result = await jsonRequest<T>(url.toString(), {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, "درخواست اسنپ‌پی ناموفق بود");
  return result;
}

export async function snapPayEligibility(credentials: Credentials, amountRial: number) {
  const response = await request<SnapEligibility>(credentials, "/api/online/offer/v1/eligible", "GET", undefined, { amount: String(amountRial) });
  return {
    eligible: response.eligible === true,
    titleMessage: String(response.title_message ?? ""),
    description: String(response.description ?? ""),
  };
}

export type SnapPayBasket = {
  amount: number;
  cartList: { cartId: number; cartItems: { amount: number; category: string; count: number; id: number; name: string; commissionType: number }[]; isShipmentIncluded: boolean; isTaxIncluded: boolean; shippingAmount: number; taxAmount: number; totalAmount: number }[];
  discountAmount: number;
  externalSourceAmount: number;
  mobile: string;
  returnURL: string;
  transactionId: string;
};

export async function snapPayCreateToken(credentials: Credentials, payload: SnapPayBasket) {
  const response = await request<SnapToken>(credentials, "/api/online/payment/v1/token", "POST", payload);
  if (!response.paymentToken || !response.paymentPageUrl) throw new Error("پاسخ دریافت توکن اسنپ‌پی ناقص است");
  let page: URL;
  try { page = new URL(response.paymentPageUrl); } catch { throw new Error("نشانی پرداخت اسنپ‌پی معتبر نیست"); }
  if (page.protocol !== "https:") throw new Error("نشانی پرداخت اسنپ‌پی امن نیست");
  return { paymentToken: response.paymentToken, paymentPageUrl: page.toString() };
}

async function snapPayStatus(credentials: Credentials, paymentToken: string, transactionId: string, amountRial: number) {
  const response = await request<{ status?: string; transactionId?: string; amount?: number }>(credentials, "/api/online/payment/v1/status", "GET", undefined, { paymentToken });
  if (response.transactionId && response.transactionId !== transactionId) throw new Error("شناسهٔ استعلام وضعیت اسنپ‌پی با سفارش مطابقت ندارد");
  if (response.amount !== undefined && Number(response.amount) !== amountRial) throw new Error("مبلغ استعلام وضعیت اسنپ‌پی با سفارش مطابقت ندارد");
  return String(response.status ?? "").toUpperCase();
}

async function action(credentials: Credentials, endpoint: "verify" | "settle" | "revert" | "cancel", paymentToken: string) {
  return request<{ transactionId?: string }>(credentials, `/api/online/payment/v1/${endpoint}`, "POST", { paymentToken });
}

/** Resolve ambiguous Verify/Settle responses through SnappPay's status endpoint before retrying. */
export async function snapPayVerifyAndSettle(credentials: Credentials, paymentToken: string, transactionId: string, amountRial: number, recovering = false) {
  let status = "";
  if (recovering) {
    status = await snapPayStatus(credentials, paymentToken, transactionId, amountRial);
    if (status !== "VERIFY" && status !== "SETTLE") {
      if (status !== "PENDING") throw new Error(`وضعیت پرداخت اسنپ‌پی قابل نهایی‌سازی نیست: ${status || "نامشخص"}`);
      const verified = await action(credentials, "verify", paymentToken);
      if (verified.transactionId && verified.transactionId !== transactionId) throw new Error("شناسهٔ تراکنش Verify اسنپ‌پی با سفارش مطابقت ندارد");
      status = "VERIFY";
    }
  } else {
    try {
      const verified = await action(credentials, "verify", paymentToken);
      if (verified.transactionId && verified.transactionId !== transactionId) throw new Error("شناسهٔ تراکنش Verify اسنپ‌پی با سفارش مطابقت ندارد");
      status = "VERIFY";
    } catch (error) {
      status = await snapPayStatus(credentials, paymentToken, transactionId, amountRial);
      if (status === "PENDING") {
        const verified = await action(credentials, "verify", paymentToken);
        if (verified.transactionId && verified.transactionId !== transactionId) throw new Error("شناسهٔ تراکنش Verify اسنپ‌پی با سفارش مطابقت ندارد");
        status = "VERIFY";
      } else if (status !== "VERIFY" && status !== "SETTLE") throw error;
    }
  }
  if (status === "SETTLE") return { transactionId };
  try {
    const settled = await action(credentials, "settle", paymentToken);
    if (settled.transactionId && settled.transactionId !== transactionId) throw new Error("شناسهٔ تراکنش Settle اسنپ‌پی با سفارش مطابقت ندارد");
    return { transactionId: settled.transactionId || transactionId };
  } catch (error) {
    status = await snapPayStatus(credentials, paymentToken, transactionId, amountRial);
    if (status === "SETTLE") return { transactionId };
    if (status !== "VERIFY") throw error;
    const settled = await action(credentials, "settle", paymentToken);
    if (settled.transactionId && settled.transactionId !== transactionId) throw new Error("شناسهٔ تراکنش Settle اسنپ‌پی با سفارش مطابقت ندارد");
    return { transactionId: settled.transactionId || transactionId };
  }
}

export async function snapPayRevert(credentials: Credentials, paymentToken: string) {
  await action(credentials, "revert", paymentToken);
}

export async function snapPayCancel(credentials: Credentials, paymentToken: string) {
  await action(credentials, "cancel", paymentToken);
}
