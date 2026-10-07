import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { getPublishedSitePage } from "@/lib/public-content-cache";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedSitePage(slug);
  return page ? { title: page.metaTitle || page.title, description: page.metaDescription || page.summary || undefined } : { title: "صفحه یافت نشد" };
}

export default async function DynamicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedSitePage(slug);
  if (!page) notFound();
  const settings = await getSettings();
  return <SitePageRenderer page={page as SitePageData} settings={settings} />;
}
