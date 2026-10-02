import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.status, "published")));
  return page ? { title: page.metaTitle || page.title, description: page.metaDescription || page.summary || undefined } : { title: "صفحه یافت نشد" };
}

export default async function DynamicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.status, "published")));
  if (!page) notFound();
  const settings = await getSettings();
  return <SitePageRenderer page={page as SitePageData} settings={settings} />;
}
