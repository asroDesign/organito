export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let activeCurrencyUnit = "تومان";
export function setCurrencyUnit(value: string) { activeCurrencyUnit = value.trim() || "تومان"; }
export function currencyUnit() { return activeCurrencyUnit; }
export function toman(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("fa-IR") + " " + activeCurrencyUnit;
}

export function faNum(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("fa-IR");
}

export function jdate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric", month: "2-digit", day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Tehran",
  }).format(date);
}

export function normalizePn(pn: string | null | undefined) {
  return (pn ?? "")
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

export function maskPhone(p: string) {
  return p.length > 6 ? `${p.slice(0, 4)}***${p.slice(-3)}` : "***";
}

export function maskIban(p: string | null | undefined) {
  if (!p) return "—";
  return p.length > 8 ? `${p.slice(0, 4)}••••••${p.slice(-4)}` : "••••";
}

export function genNumber(prefix: string) {
  const t = Date.now().toString().slice(-7);
  const r = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${t}${r}`;
}

export const ORDER_STATUS: Record<string, string> = {
  pending_payment: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال پردازش",
  shipped: "ارسال‌شده", completed: "تکمیل‌شده", cancelled: "لغوشده",
};
export const SHIPMENT_STATUS: Record<string, string> = {
  pending: "در انتظار", preparing: "در حال آماده‌سازی", ready: "آماده ارسال", shipped: "ارسال‌شده",
  delivered: "تحویل‌شده", cancelled: "لغوشده", returned: "مرجوعی",
};
export const PRODUCT_STATUS: Record<string, string> = {
  draft: "پیش‌نویس", pending: "در انتظار بررسی", approved: "تأییدشده", active: "فعال", inactive: "غیرفعال",
  out_of_stock: "ناموجود", rejected: "ردشده", suspended: "تعلیق‌شده", deleted: "حذف‌شده",
};
export const OFFER_STATUS: Record<string, string> = {
  pending: "در انتظار تأیید", approved: "تأییدشده", rejected: "ردشده", inactive: "غیرفعال", suspended: "تعلیق",
};
export const WITHDRAW_STATUS: Record<string, string> = {
  pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده", processing: "در حال پرداخت", paid: "پرداخت‌شده", cancelled: "لغوشده",
};
export const TICKET_STATUS: Record<string, string> = {
  open: "باز", in_review: "در حال بررسی", pending_customer: "در انتظار مشتری", pending_staff: "در انتظار کارشناس", resolved: "حل‌شده", closed: "بسته",
};
export const SUPPLY_STATUS: Record<string, string> = {
  pending: "ثبت‌شده", reviewing: "در حال بررسی", internal_match_found: "یافت‌شده در کاتالوگ", supplier_search: "جست‌وجوی تأمین‌کننده",
  rfq_sent: "RFQ ارسال شد", supplier_found: "تأمین‌کننده یافت شد", price_calculated: "قیمت محاسبه شد", quotation_sent: "پیش‌فاکتور صادر شد",
  customer_approved: "تأیید مشتری", payment_pending: "در انتظار پرداخت", paid: "پرداخت‌شده", purchasing: "در حال خرید",
  received: "دریافت‌شده", ready_to_ship: "آماده ارسال", shipped: "ارسال‌شده", completed: "تکمیل‌شده", cancelled: "لغوشده", rejected: "ردشده",
};
export const AUTH_LABEL: Record<string, string> = { Original: "ارگانیک گواهی‌شده", OEM: "طبیعی و بدون افزودنی", Aftermarket: "محلی و سنتی" };

export function str(v: unknown, max = 2000): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, max);
}
export function int(v: unknown, min = 0, max = 1_000_000_000_000): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, "مقدار عددی نامعتبر است");
  return n;
}
