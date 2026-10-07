import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { siteMenuItems, siteMenus } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { SiteMenuManager } from "@/components/SiteMenuManager";
import { ListTree } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function SiteMenusAdminPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const [menus, items] = await Promise.all([
    db.select().from(siteMenus).orderBy(asc(siteMenus.id)),
    db.select().from(siteMenuItems).where(isNull(siteMenuItems.deletedAt)).orderBy(asc(siteMenuItems.sortOrder), asc(siteMenuItems.id)),
  ]);
  return <><PageHeader title="مدیریت منوهای سایت" subtitle="ساخت و مرتب‌سازی منوهای هدر، فوتر و موبایل"/><FeatureIntro className="mb-5" icon={ListTree} title="منوساز سایت" text="پیوندهای فعلی فوتر به منوی جدید منتقل شده‌اند. جایگاه‌ها مستقل هستند و می‌توانید پیوند داخلی یا HTTPS، زیرمنو، وضعیت نمایش و بازشدن در زبانه جدید را تنظیم کنید."/><SiteMenuManager initial={menus.map((menu) => ({ ...menu, placement: menu.placement as "header" | "footer" | "mobile", items: items.filter((item) => item.menuId === menu.id) }))}/></>;
}
