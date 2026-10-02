import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";

const fallback: SitePageData = {
  title: "درباره ما", slug: "about", template: "nature", summary: null, metaTitle: null, metaDescription: null, status: "published",
  blocks: [
    { type: "hero", title: "درباره {{siteName}}", body: "{{siteName}} پلتفرمی تخصصی برای خرید، استعلام و تأمین محصولات ارگانیک است که انبار مرکزی و تأمین‌کنندگان معتبر را در یک بستر امن گرد هم آورده است." },
    { type: "features", title: "آنچه برای شما فراهم کرده‌ایم", items: [
      { title: "تضمین اصالت", body: "محصولات با بررسی و اطلاعات شفاف عرضه می‌شوند." },
      { title: "انتخاب آگاهانه", body: "کیفیت، قیمت و شرایط تأمین را مقایسه کنید." },
      { title: "ارسال شفاف", body: "وضعیت هر سفارش و مرسوله را پیگیری کنید." },
      { title: "تأمین محصول", body: "محصول مورد نیازتان را از کارشناسان استعلام کنید." },
    ] },
  ],
};

export async function generateMetadata() {
  const [page] = await db.select().from(contentPages).where(eq(contentPages.slug, "about"));
  return { title: page?.metaTitle || page?.title || fallback.title, description: page?.metaDescription || page?.summary || undefined };
}

export default async function About() {
  const [row] = await db.select().from(contentPages).where(eq(contentPages.slug, "about"));
  const settings = await getSettings();
  return <SitePageRenderer page={(row ?? fallback) as SitePageData} settings={settings} />;
}
