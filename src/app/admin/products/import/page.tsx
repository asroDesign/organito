import { asc } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { DigikalaProductImporter } from "@/components/DigikalaProductImporter";

export default async function DigikalaProductImportPage() {
  await requirePage({ perm: "PRODUCTS_CREATE" });
  const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  return <>
    <PageHeader title="ورود مجاز اطلاعات محصول" subtitle="ساخت پیش‌نویس با ثبت شناسه منبع و بازبینی دستی اطلاعات واردشده" />
    <FeatureIntro className="my-5" icon={Download} title="ورود اطلاعات محصول دیجی‌کالا" tone="yellow" text="لینک فقط برای ثبت ارجاع منبع استفاده می‌شود. داده‌های متنی مجاز را وارد و قبل از ساخت پیش‌نویس مرور کنید؛ انتشار، تصاویر، قیمت و موجودی نیازمند تکمیل دستی هستند." />
    <DigikalaProductImporter categories={rows} />
  </>;
}
