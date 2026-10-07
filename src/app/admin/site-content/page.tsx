import { and, asc, desc, eq, isNull, not } from "drizzle-orm";
import { db } from "@/db";
import { contentPages, footerLinks } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SiteContentManager } from "@/components/SiteContentManager";

export default async function SiteContentAdmin() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const [pages, links] = await Promise.all([
    db.select().from(contentPages).where(and(not(eq(contentPages.slug, "home")), isNull(contentPages.deletedAt))).orderBy(desc(contentPages.updatedAt)),
    db.select().from(footerLinks).orderBy(asc(footerLinks.groupTitle), asc(footerLinks.sortOrder), asc(footerLinks.id)),
  ]);
  return <><PageHeader title="صفحات و محتوای سایت" subtitle="صفحه‌ساز و مدیریت صفحه‌های درباره ما، تماس با ما و محتوای اختصاصی" /><SiteContentManager initialPages={pages} initialLinks={links} /></>;
}
