import { db } from "@/db";
import { settings } from "@/db/schema";
import type { DB } from "./types";
import { setCurrencyUnit } from "./util";

export const DEFAULT_SETTINGS = {
  siteName: "سبزینه",
  siteTagline: "بازار آنلاین محصولات ارگانیک و طبیعی",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000",
  homeSeoTitle: "سبزینه | خرید محصولات ارگانیک و طبیعی",
  homeSeoDescription: "خرید آنلاین محصولات ارگانیک، طبیعی و محلی مستقیم از کشاورزان و تولیدکنندگان معتبر با تضمین کیفیت.",
  homeSeoKeywords: "محصولات ارگانیک، خرید عسل طبیعی، روغن ارگانیک، غذای سالم",
  shopSeoTitle: "فروشگاه محصولات ارگانیک و طبیعی",
  shopSeoDescription: "فروشگاه آنلاین محصولات ارگانیک، طبیعی و محلی؛ مقایسه، انتخاب و خرید مستقیم از تولیدکنندگان منتخب.",
  shopSeoKeywords: "فروشگاه ارگانیک، محصولات طبیعی، خرید آنلاین محصولات سالم",
  blogSeoTitle: "مجله سبزینه | راهنمای زندگی سالم و محصولات ارگانیک",
  blogSeoDescription: "مقالات تخصصی درباره تغذیه سالم، محصولات ارگانیک، کشاورزی پایدار و سبک زندگی طبیعی.",
  blogSeoKeywords: "مجله سلامت، تغذیه سالم، محصولات ارگانیک، سبک زندگی سالم",
  defaultOgImageId: 0,
  currency: "تومان",
  siteLogoMediaId: 0,
  taxRate: 10,
  defaultCommission: 8,
  minWithdrawal: 500000,
  releasePolicy: "on_customer_confirm",
  paymentGateway: "zarinpal",
  zibalMerchant: "",
  watermarkEnabled: 0,
  watermarkText: "سبزینه",
  watermarkImageId: 0,
  watermarkPosition: "southeast",
  watermarkOpacity: 45,
  smsProvider: "kavenegar",
  smsSender: "10008663",
  smsApiKey: "",
  smsirParameterMap: "",
  inventoryPolicy: "reserve_on_order",
  supplyDefaultMargin: 15,
  supplyShippingCost: 90000,
  centralShippingCost: 85000,
  senderName: "انبار مرکزی سبزینه",
  senderAddress: "تهران، خیابان امین‌حضور، پلاک ۱۲",
  marketplaceRules: "فروشندگان موظف به ارسال کالای اصل و مطابق مشخصات هستند.",
  economicCode: "411111111111",
  orderExpiryMinutes: 120,
  multiVendor: 1,
  allowSellerSignup: 1,
  heroType: "image",
  heroMediaId: 0,
  heroTitle: "طعم واقعی طبیعت، ارگانیک و بی‌واسطه",
  heroSubtitle: "عسل طبیعی، روغن‌های پرس سرد، ادویه، خشکبار و سبزیجات تازه از کشاورزان و تولیدکنندگان منتخب با گواهی معتبر.",
  supportPhone: "021-91000000",
  supportHours: "همه روزه ۱۰ تا ۲۱",
  returnDays: 10,
  freeShippingOver: 2000000,
  reviewAutoApprove: 0,
  senderPhone: "021-91000000",
  senderPostalCode: "1136914311",
  senderCity: "تهران",
  bankAccountInfo: "بانک ملت — کارت ۶۱۰۴-۳۳۷۸-۱۲۳۴-۵۶۷۸ — شبا IR120120000000001234567890 — به نام شرکت سبزینه",
  labelShowLogo: 1,
  labelShowOrderBarcode: 1,
  labelBorderStyle: "solid",
  invoiceFooter: "کالای فروخته‌شده تا ۷ روز با حفظ شرایط اولیه قابل مرجوع است.",
  labelWidth: 100,
  labelHeight: 150,
  labelFontSize: 12,
  labelShowBarcode: 1,
  labelShowSender: 1,
  labelShowItems: 1,
  labelTemplate: "# گیرنده: {receiver}\nتلفن: {phone}\nآدرس: {city} - {address}\nکد پستی: {postalCode}\n---\nسفارش: {order} | مرسوله: {shipment}\nحامل: {carrier} | تعداد بسته: {packages}\n! شکستنی — با احتیاط حمل شود",
};
export type SettingsShape = typeof DEFAULT_SETTINGS;

export async function getSettings(tx: DB = db): Promise<SettingsShape> {
  const rows = await tx.select().from(settings);
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  setCurrencyUnit(String(out.currency ?? DEFAULT_SETTINGS.currency));
  return out as SettingsShape;
}
