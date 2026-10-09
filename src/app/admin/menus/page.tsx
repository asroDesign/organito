import Link from "next/link";
import { asc, isNull, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteMenuItems, siteMenus, settings } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { SiteMenuManager } from "@/components/SiteMenuManager";
import { ListTree } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function SiteMenusAdminPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const [footerState] = await db.select().from(settings).where(eq(settings.key, "siteFooterBuilderV1"));
  const footerBuilderEnabled = (footerState?.value as { config?: { enabled?: boolean } } | undefined)?.config?.enabled === true;
  const [menus, items] = await Promise.all([
    db.select().from(siteMenus).orderBy(asc(siteMenus.id)),
    db.select().from(siteMenuItems).where(isNull(siteMenuItems.deletedAt)).orderBy(asc(siteMenuItems.sortOrder), asc(siteMenuItems.id)),
  ]);
  return <><PageHeader title="مدیریت منوهای سایت" subtitle="ساخت و مرتب‌سازی منوهای هدر، فوتر و موبایل"/><FeatureIntro className="mb-5" icon={ListTree} title="منوساز سایت" text="پیوندهای فعلی فوتر به منوی جدید منتقل شده‌اند. جایگاه‌ها مستقل هستند و می‌توانید پیوند داخلی یا HTTPS، زیرمنو، وضعیت نمایش و بازشدن در زبانه جدید را تنظیم کنید."/><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"><p className="text-sm">{footerBuilderEnabled ? "فوترساز فعال است؛ محتوای پایین سایت را از فوترساز ویرایش کنید. منوی قدیمی فوتر برای بازگشت به طرح قبلی محفوظ است." : "برای افزودن بخش، تصویر، متن و HTML به پایین سایت از فوترساز استفاده کنید."}</p><Link href="/admin/footer-builder" className="btn-primary">بازکردن فوترساز سایت</Link></div><SiteMenuManager initial={menus.map((menu) => ({ ...menu, placement: menu.placement as "header" | "footer" | "mobile", items: items.filter((item) => item.menuId === menu.id) }))}/></>;
}
