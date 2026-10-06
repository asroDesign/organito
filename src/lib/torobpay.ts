type TorobResponse<T> = { successful?: boolean; response?: T; error?: { code?: number; message?: string; user_message?: string } };

const API = "https://cpg.torobpay.com";
type Credentials = { clientId: string; clientSecret: string; username: string; password: string };
type TorobOrder = {
  amountToman: number; discountToman: number; externalSourceToman: number; shippingToman: number; taxToman: number;
  mobile: string; returnUrl: string; transactionId: string; cartId: string;
  items: { id: string; name: string; count: number; unitPriceToman: number; category: string }[];
  address: string; postalCode: string; fullName: string; city: string; province: string;
};

const credentialsReady = (c: Credentials) => Object.values(c).every((v) => v.trim().length > 0);
async function request<T>(path: string, token: string | null, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(18000),
  });
  const text = await response.text();
  let data: TorobResponse<T>;
  try { data = JSON.parse(text) as TorobResponse<T>; }
  catch { throw new Error(`پاسخ نامعتبر ترب‌پی (HTTP ${response.status})`); }
  if (!response.ok || data.successful === false || data.error) throw new Error(data.error?.user_message || data.error?.message || `خطای ترب‌پی (HTTP ${response.status})`);
  return (data.response ?? data) as T;
}

async function tokenFor(c: Credentials) {
  if (!credentialsReady(c)) throw new Error("اطلاعات اتصال ترب‌پی کامل نشده است");
  const basic = Buffer.from(`${c.clientId.trim()}:${c.clientSecret.trim()}`).toString("base64");
  const response = await fetch(`${API}/api/online/v1/oauth/token`, {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: c.username.trim(), password: c.password }), cache: "no-store", signal: AbortSignal.timeout(18000),
  });
  const data = await response.json() as { access_token?: string; error?: { user_message?: string; message?: string }; successful?: boolean; response?: { access_token?: string } };
  const accessToken = data.access_token || data.response?.access_token;
  if (!response.ok || data.successful === false || !accessToken) throw new Error(data.error?.user_message || data.error?.message || `احراز هویت ترب‌پی ناموفق بود (HTTP ${response.status})`);
  return accessToken;
}

export async function torobPayEligible(c: Credentials, amountRial: number) {
  if (amountRial < 200000 || amountRial > 1_000_000_000) return { eligible: false, titleMessage: "مبلغ سفارش در بازه پرداخت ترب‌پی نیست", description: "محدوده مبلغ طبق مستند ترب‌پی از ۲۰۰٬۰۰۰ ریال تا ۱٬۰۰۰٬۰۰۰٬۰۰۰ ریال است." };
  const token = await tokenFor(c);
  const result = await request<{ eligible?: boolean; title_message?: string; description?: string }>(`/api/online/offer/v1/eligible?amount=${encodeURIComponent(amountRial)}`, token, undefined, "GET");
  return { eligible: result.eligible === true, titleMessage: result.title_message ?? "پرداخت اعتباری ترب‌پی", description: result.description ?? "" };
}

export async function torobPayCreate(c: Credentials, order: TorobOrder) {
  const token = await tokenFor(c);
  const response = await request<{ paymentToken?: string; paymentPageUrl?: string }>("/api/online/payment/v1/token", token, {
    amount: order.amountToman * 10,
    discountAmount: order.discountToman * 10,
    externalSourceAmount: order.externalSourceToman * 10,
    mobile: order.mobile,
    paymentMethodTypeDto: "ONLINE_CREDIT",
    returnURL: order.returnUrl,
    transactionId: order.transactionId,
    cartList: [{
      cartId: order.cartId, totalAmount: order.amountToman * 10, taxAmount: order.taxToman * 10, shippingAmount: order.shippingToman * 10,
      isTaxIncluded: true, isShipmentIncluded: true,
      cartItems: order.items.map((item) => ({ id: item.id, name: item.name, count: item.count, amount: item.unitPriceToman * 10, category: item.category, commissionType: 0 })),
    }],
    address: order.address, postalCode: order.postalCode, customer_full_name: order.fullName, city: order.city, province: order.province,
    registration_phone_number: order.mobile,
  });
  if (!response.paymentToken || !response.paymentPageUrl) throw new Error("ترب‌پی توکن یا نشانی پرداخت را برنگرداند");
  return { paymentToken: response.paymentToken, paymentPageUrl: response.paymentPageUrl };
}

export async function torobPayVerify(c: Credentials, paymentToken: string) {
  const token = await tokenFor(c);
  const response = await request<{ transactionId?: string }>("/api/online/payment/v1/verify", token, { paymentToken });
  if (!response.transactionId) throw new Error("پاسخ تأیید ترب‌پی فاقد شناسه تراکنش است");
  return response.transactionId;
}

export async function torobPaySettle(c: Credentials, paymentToken: string) {
  const token = await tokenFor(c);
  await request("/api/online/payment/v1/settle", token, { paymentToken });
}

export async function torobPayRevert(c: Credentials, paymentToken: string) {
  const token = await tokenFor(c);
  await request("/api/online/payment/v1/revert", token, { paymentToken });
}
