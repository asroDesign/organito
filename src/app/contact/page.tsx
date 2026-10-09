import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { seoMetadata } from "@/lib/seo";

const fallback: SitePageData = {
  title: "تماس با ما", slug: "contact", template: "contact", summary: "راه‌های ارتباط با پشتیبانی", metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "تماس با ما", body: "برای پیگیری سفارش، مشاوره یا امور مالی با ما در ارتباط باشید." },
    { type: "cta", title: "پشتیبانی آنلاین", body: "برای پیگیری سفارش یا دریافت راهنمایی، تیکت ثبت کنید تا درخواست شما به واحد مربوطه ارجاع شود.", buttonLabel: "ثبت تیکت پشتیبانی", href: "/customer/tickets" },
  ],
};

export async function generateMetadata() {
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "contact"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return seoMetadata(settings, { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || settings.homeSeoDescription, path: "/contact" });
}

export default async function Contact() {
  const [row] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "contact"), eq(contentPages.status, "published"), isNull(contentPages.deletedAt)));
  const settings = await getSettings();
  return <SitePageRenderer page={(row ?? fallback) as SitePageData} settings={settings} />;
}
