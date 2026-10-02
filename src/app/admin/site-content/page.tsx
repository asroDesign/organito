import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { contentPages, footerLinks } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SiteContentManager } from "@/components/SiteContentManager";

export default async function SiteContentAdmin() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  await db.insert(contentPages).values({ title: "صفحه‌ساز صفحه اصلی", slug: "home", template: "nature", blocks: [], status: "published" }).onConflictDoNothing();
  const [pages, links] = await Promise.all([
    db.select().from(contentPages).orderBy(desc(contentPages.updatedAt)),
    db.select().from(footerLinks).orderBy(asc(footerLinks.groupTitle), asc(footerLinks.sortOrder), asc(footerLinks.id)),
  ]);
  return <><PageHeader title="صفحات و محتوای سایت" subtitle="صفحه‌ساز، مدیریت درباره ما و تماس با ما و ویرایش منوهای فوتر" /><SiteContentManager initialPages={pages} initialLinks={links} /></>;
}
