import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client";
import { HeroEditor } from "@/components/HeroEditor";

export default async function SettingsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="تنظیمات کلان" subtitle="تمام تغییرات در Audit Log ثبت می‌شوند" />
      <Card title="حالت فروشگاه: چندفروشندگی یا تک‌فروشنده" className="mb-6">
        <JsonForm url="/api/admin/settings" submit="ذخیره حالت فروشگاه" resetOnDone={false} fields={[
          { name: "multiVendor", label: "حالت فروشگاه", type: "select", half: true, defaultValue: String(s.multiVendor), options: [["1", "مارکت‌پلیس چندفروشنده (نمایش و انتخاب فروشندگان)"], ["0", "فروشگاه تک‌فروشنده (بدون نمایش فروشندگان)"]] },
          { name: "allowSellerSignup", label: "ثبت‌نام تولیدکنندگان جدید", type: "select", half: true, defaultValue: String(s.allowSellerSignup), options: [["1", "مجاز"], ["0", "غیرفعال"]] },
          { name: "reviewAutoApprove", label: "انتشار دیدگاه و پرسش", type: "select", half: true, defaultValue: String(s.reviewAutoApprove), options: [["0", "پس از تأیید مدیر"], ["1", "انتشار خودکار"]] },
        ]} />
        <p className="mt-3 text-xs leading-6 text-slate-500">در حالت تک‌فروشنده، فهرست و مقایسه فروشندگان، تعداد فروشنده روی کارت‌ها، بخش تولیدکنندگان و لینک «تولیدکننده شوید» پنهان می‌شود و در صفحه محصول فقط یک گزینه خرید (موجودی فروشگاه یا بهترین پیشنهاد) با نام فروشگاه نمایش داده می‌شود. پنل و سفارش‌های فروشندگان فعلی حفظ می‌شود.</p>
      </Card>
      <Card title="هیرو صفحه اصلی (تصویر / GIF / ویدیو)" className="mb-6"><HeroEditor initial={{ heroMediaId: s.heroMediaId, heroType: s.heroType, heroTitle: s.heroTitle, heroSubtitle: s.heroSubtitle }} /></Card>
      <Card title="تنظیمات عمومی">
        <JsonForm url="/api/admin/settings" submit="ذخیره تنظیمات" resetOnDone={false} fields={[
          { name: "siteName", label: "نام سامانه", half: true, defaultValue: s.siteName },
          { name: "siteTagline", label: "شعار", half: true, defaultValue: s.siteTagline },
          { name: "currency", label: "واحد پول", half: true, defaultValue: s.currency },
          { name: "taxRate", label: "نرخ مالیات (%)", type: "number", half: true, defaultValue: s.taxRate },
          { name: "defaultCommission", label: "کمیسیون پیش‌فرض (%)", type: "number", half: true, defaultValue: s.defaultCommission },
          { name: "minWithdrawal", label: "حداقل برداشت (تومان)", type: "number", half: true, defaultValue: s.minWithdrawal },
          { name: "releasePolicy", label: "سیاست آزادسازی وجه", type: "select", half: true, defaultValue: s.releasePolicy, options: [["on_customer_confirm", "پس از تأیید تحویل"], ["on_delivery", "پس از ثبت تحویل"]] },
          { name: "supportPhone", label: "تلفن پشتیبانی", half: true, defaultValue: s.supportPhone },
          { name: "supportHours", label: "ساعات پاسخگویی", half: true, defaultValue: s.supportHours },
          { name: "freeShippingOver", label: "ارسال رایگان از مبلغ (نمایشی)", type: "number", half: true, defaultValue: s.freeShippingOver },
          { name: "returnDays", label: "مهلت بازگشت کالا (روز)", type: "number", half: true, defaultValue: s.returnDays },
          { name: "orderExpiryMinutes", label: "لغو خودکار سفارش پرداخت‌نشده (دقیقه، ۰=غیرفعال)", type: "number", half: true, defaultValue: s.orderExpiryMinutes },
          { name: "paymentGateway", label: "درگاه پرداخت", type: "select", half: true, defaultValue: s.paymentGateway, options: [["zarinpal", "زرین‌پال"], ["idpay", "آیدی‌پی"], ["mellat", "بانک ملت"]] },
          { name: "smsProvider", label: "Provider پیامک", type: "select", half: true, defaultValue: s.smsProvider, options: [["kavenegar", "کاوه‌نگار"], ["smsir", "SMS.ir"]] },
          { name: "smsSender", label: "شماره فرستنده پیامک", half: true, defaultValue: s.smsSender },
          { name: "inventoryPolicy", label: "سیاست موجودی", type: "select", half: true, defaultValue: s.inventoryPolicy, options: [["reserve_on_order", "رزرو در ثبت سفارش"]] },
          { name: "supplyDefaultMargin", label: "حاشیه پیش‌فرض تأمین (%)", type: "number", half: true, defaultValue: s.supplyDefaultMargin },
          { name: "supplyShippingCost", label: "هزینه ارسال تأمین سفارشی", type: "number", half: true, defaultValue: s.supplyShippingCost },
          { name: "centralShippingCost", label: "هزینه ارسال انبار مرکزی", type: "number", half: true, defaultValue: s.centralShippingCost },
          { name: "senderName", label: "نام فرستنده", half: true, defaultValue: s.senderName },
          { name: "senderAddress", label: "آدرس فرستنده", half: true, defaultValue: s.senderAddress },
          { name: "senderCity", label: "شهر فرستنده", half: true, defaultValue: s.senderCity },
          { name: "senderPhone", label: "تلفن فرستنده", half: true, defaultValue: s.senderPhone },
          { name: "senderPostalCode", label: "کد پستی فرستنده", half: true, defaultValue: s.senderPostalCode },
          { name: "economicCode", label: "کد اقتصادی", half: true, defaultValue: s.economicCode },
          { name: "bankAccountInfo", label: "اطلاعات حساب برای کارت به کارت / حواله", type: "textarea", defaultValue: s.bankAccountInfo },
          { name: "invoiceFooter", label: "پانویس فاکتور", type: "textarea", defaultValue: s.invoiceFooter },
          { name: "marketplaceRules", label: "قوانین مارکت‌پلیس", type: "textarea", defaultValue: s.marketplaceRules },
        ]} />
      </Card>
    </>
  );
}
