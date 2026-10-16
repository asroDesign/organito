import { requirePage } from "@/lib/auth";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client";
import { HeroEditor } from "@/components/HeroEditor";
import PosTerminalManager from "@/components/PosTerminalManager";
import { ProductTypeManager } from "@/components/ProductTypeManager";
import { StorefrontMessagesSettings } from "@/components/StorefrontMessagesSettings";

export default async function SettingsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  const popups = Array.isArray(s.specialPopups) && s.specialPopups.length
    ? s.specialPopups
    : Number(s.specialPopupEnabled) === 1 && Array.isArray(s.specialPopupProductIds) && s.specialPopupProductIds.length
      ? [{ id: "legacy-special", enabled: true, title: s.specialPopupTitle, body: s.specialPopupBody, imageId: Number(s.specialPopupMediaId), productIds: s.specialPopupProductIds, buttonLabel: s.specialPopupButtonLabel, delaySeconds: Number(s.specialPopupDelaySeconds), repeatHours: Number(s.specialPopupRepeatHours) }]
      : [];
  const selectedIds = [...new Set(popups.flatMap((popup) => popup.productIds ?? []))];
  const selectedProducts = selectedIds.length ? await db.select({ id: products.id, name: products.nameFa, sku: products.sku, imageId: products.mainImageId }).from(products).where(inArray(products.id, selectedIds)) : [];
  return (
    <>
      <PageHeader title="تنظیمات کلان" subtitle="تمام تغییرات در Audit Log ثبت می‌شوند" />
      <Card title="حالت فروشگاه: چندفروشندگی یا تک‌فروشنده" className="mb-6">
        <JsonForm url="/api/admin/settings" submit="ذخیره حالت فروشگاه" resetOnDone={false} fields={[
          { name: "multiVendor", label: "حالت فروشگاه", type: "select", half: true, defaultValue: String(s.multiVendor), options: [["1", "مارکت‌پلیس چندفروشنده (نمایش و انتخاب فروشندگان)"], ["0", "فروشگاه تک‌فروشنده (بدون نمایش فروشندگان)"]] },
          { name: "allowSellerSignup", label: "ثبت‌نام تولیدکنندگان جدید", type: "select", half: true, defaultValue: String(s.allowSellerSignup), options: [["1", "مجاز"], ["0", "غیرفعال"]] },
          { name: "reviewAutoApprove", label: "انتشار دیدگاه و پرسش", type: "select", half: true, defaultValue: String(s.reviewAutoApprove), options: [["0", "پس از تأیید مدیر"], ["1", "انتشار خودکار"]] },
          { name: "productLiveViewers", label: "نمایش تعداد بینندگان آنلاین صفحه محصول", type: "select", half: true, defaultValue: String(s.productLiveViewers), options: [["0", "غیرفعال"], ["1", "فعال"]] },
        ]} />
        <p className="mt-3 text-xs leading-6 text-slate-500">در حالت تک‌فروشنده، فهرست و مقایسه فروشندگان، تعداد فروشنده روی کارت‌ها، بخش تولیدکنندگان و لینک «تولیدکننده شوید» پنهان می‌شود و در صفحه محصول فقط یک گزینه خرید (موجودی فروشگاه یا بهترین پیشنهاد) با نام فروشگاه نمایش داده می‌شود. پنل و سفارش‌های فروشندگان فعلی حفظ می‌شود.</p>
      </Card>
      <Card title="هیرو صفحه اصلی (تصویر / GIF / ویدیو)" className="mb-6"><HeroEditor initial={{ heroMediaId: s.heroMediaId, heroType: s.heroType, heroTitle: s.heroTitle, heroSubtitle: s.heroSubtitle }} /></Card>
      <Card title="کارتخوان‌های فروش حضوری" className="mb-6"><p className="text-xs leading-6 text-slate-500">کارتخوان‌های فعال این فهرست هنگام ثبت فروش حضوری انبار مرکزی انتخاب می‌شوند.</p><PosTerminalManager listUrl="/api/admin/settings/pos-terminals" manageUrl="/api/admin/settings/pos-terminals" /></Card>
      <Card title="پاپ‌آپ پیشنهاد ویژه و نوار اعلان" className="mb-6"><StorefrontMessagesSettings initial={{ announcementEnabled: Number(s.announcementEnabled), announcementText: s.announcementText, announcementHref: s.announcementHref, announcementTheme: s.announcementTheme, specialPopups: popups }} initialProducts={selectedProducts}/></Card>
      <Card title="تنظیمات عمومی">
        <JsonForm url="/api/admin/settings" submit="ذخیره تنظیمات" resetOnDone={false} fields={[
          { name: "siteName", label: "نام سامانه", half: true, defaultValue: s.siteName },
          { name: "siteTagline", label: "شعار", half: true, defaultValue: s.siteTagline },
          { name: "currency", label: "واحد پول", half: true, defaultValue: s.currency },
          { name: "siteLogoMediaId", label: "شناسه فایل لوگو از مرکز فایل (۰=لوگوی متنی)", type: "number", half: true, defaultValue: s.siteLogoMediaId },
          { name: "taxRate", label: "نرخ مالیات (%)", type: "number", half: true, defaultValue: s.taxRate },
          { name: "defaultCommission", label: "کمیسیون پیش‌فرض (%)", type: "number", half: true, defaultValue: s.defaultCommission },
          { name: "minWithdrawal", label: "حداقل برداشت (تومان)", type: "number", half: true, defaultValue: s.minWithdrawal },
          { name: "loyaltyPointValue", label: "ارزش هر امتیاز باشگاه (تومان)", type: "number", half: true, defaultValue: s.loyaltyPointValue },
          { name: "reviewRewardPoints", label: "امتیاز ثبت دیدگاه پس از تحویل کالا (۰ = غیرفعال)", type: "number", half: true, defaultValue: s.reviewRewardPoints },
          { name: "organicBadgeLabel", label: "عنوان نشان تأیید اصالت محصول", half: true, defaultValue: s.organicBadgeLabel },
          { name: "releasePolicy", label: "سیاست آزادسازی وجه", type: "select", half: true, defaultValue: s.releasePolicy, options: [["on_customer_confirm", "پس از تأیید تحویل"], ["on_delivery", "پس از ثبت تحویل"]] },
          { name: "supportPhone", label: "تلفن پشتیبانی", half: true, defaultValue: s.supportPhone },
          { name: "supportEmail", label: "ایمیل پشتیبانی", half: true, defaultValue: s.supportEmail },
          { name: "supportHours", label: "ساعات پاسخگویی", half: true, defaultValue: s.supportHours },
          { name: "freeShippingOver", label: "ارسال رایگان از مبلغ (نمایشی)", type: "number", half: true, defaultValue: s.freeShippingOver },
          { name: "returnDays", label: "مهلت بازگشت کالا (روز)", type: "number", half: true, defaultValue: s.returnDays },
          { name: "orderExpiryMinutes", label: "لغو خودکار سفارش پرداخت‌نشده (دقیقه، ۰=غیرفعال)", type: "number", half: true, defaultValue: s.orderExpiryMinutes },
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
          { name: "watermarkEnabled", label: "واترمارک تصاویر جدید", type: "select", half: true, defaultValue: String(s.watermarkEnabled), options: [["0", "غیرفعال"], ["1", "فعال"]] },
          { name: "watermarkText", label: "متن واترمارک", half: true, defaultValue: s.watermarkText },
          { name: "watermarkImageId", label: "شناسه تصویر لوگوی واترمارک (اختیاری)", type: "number", half: true, defaultValue: s.watermarkImageId },
          { name: "watermarkOpacity", label: "شفافیت واترمارک (۱۰ تا ۱۰۰)", type: "number", half: true, defaultValue: s.watermarkOpacity },
          { name: "watermarkPosition", label: "محل واترمارک", type: "select", half: true, defaultValue: s.watermarkPosition, options: [["southeast", "پایین راست"], ["southwest", "پایین چپ"], ["center", "وسط"], ["northeast", "بالا راست"], ["northwest", "بالا چپ"]] },
          { name: "marketplaceRules", label: "قوانین مارکت‌پلیس", type: "textarea", defaultValue: s.marketplaceRules },
        ]} />
      </Card>
      <Card title="نوع محصول و پارامترها" className="mt-6"><ProductTypeManager initial={s.productTypes} /></Card>
      <Card title="کدهای جاوااسکریپت فوتر" className="mt-6">
        <p className="mb-4 text-sm leading-7 text-slate-600">کد نماد اعتماد، گفتینو یا ابزارهای پشتیبانی را اینجا وارد کنید. کد فقط در فوتر صفحات عمومی سایت اجرا می‌شود و در پنل مدیریت نمایش داده نخواهد شد. این بخش محتوای واردشده را به‌عنوان کد اجرایی در نظر می‌گیرد؛ فقط کد سرویس‌های مورداعتماد را وارد کنید.</p>
        <JsonForm url="/api/admin/settings" submit="ذخیره کد فوتر" resetOnDone={false} fields={[
          { name: "footerScripts", label: "کد جاوااسکریپت / کد جایگذاری سرویس", type: "textarea", defaultValue: s.footerScripts },
        ]} />
      </Card>
    </>
  );
}
