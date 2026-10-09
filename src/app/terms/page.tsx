import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { seoMetadata } from "@/lib/seo";

const fallback: SitePageData = {
  title: "شرایط استفاده", slug: "terms", template: "editorial", summary: "چارچوب استفاده از خدمات فروشگاه", metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "شرایط استفاده از وب‌سایت", body: "این صفحه چارچوب استفاده از خدمات فروشگاه و ثبت سفارش را توضیح می‌دهد. برای آشنایی با حقوق و مسئولیت‌های خود، بخش‌های زیر را مطالعه کنید.", options: { badge: "راهنمای مشتریان" } },
    { type: "text", title: "استفاده از خدمات", body: "با استفاده از وب‌سایت، متعهد می‌شوید اطلاعات صحیح و به‌روز وارد کنید و از خدمات در چهارچوب قوانین جاری استفاده نمایید. مسئولیت نگهداری اطلاعات ورود حساب کاربری بر عهده شماست." },
    { type: "text", title: "ثبت سفارش و پرداخت", body: "ثبت سفارش پس از انتخاب محصول و تکمیل مراحل سبد خرید انجام می‌شود. موجودی، قیمت و زمان آماده‌سازی ممکن است با توجه به نوع محصول و تأمین‌کننده متفاوت باشد؛ اطلاعات نهایی پیش از پرداخت به شما نمایش داده می‌شود." },
    { type: "text", title: "ارسال، مرجوعی و پشتیبانی", body: "روش ارسال بر اساس نشانی و گزینه‌های قابل انتخاب هنگام ثبت سفارش تعیین می‌شود. درخواست‌های پیگیری یا مرجوعی از مسیرهای اعلام‌شده در پنل کاربری و صفحه تماس با ما بررسی خواهند شد." },
    { type: "text", title: "حریم خصوصی و به‌روزرسانی شرایط", body: "اطلاعات کاربران برای ارائه خدمات، پردازش سفارش و پشتیبانی استفاده می‌شود. نسخه جاری شرایط استفاده در همین صفحه منتشر خواهد شد." },
  ],
};

export async function generateMetadata() {
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "terms"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return seoMetadata(settings, { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || settings.homeSeoDescription, path: "/terms" });
}

export default async function TermsPage() {
  const [row] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "terms"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return <SitePageRenderer page={(row ?? fallback) as SitePageData} settings={settings} />;
}
