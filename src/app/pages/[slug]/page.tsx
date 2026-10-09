import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { SitePageRenderer, type SitePageData } from "@/components/SitePageRenderer";
import { getPublishedSitePage } from "@/lib/public-content-cache";
import { seoMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPublishedSitePage(slug), getSettings()]);
  return page ? seoMetadata(settings, { title: page.metaTitle || page.title, description: page.metaDescription || page.summary || settings.homeSeoDescription, path: `/pages/${page.slug}` }) : { title: "صفحه یافت نشد", robots: { index: false, follow: false } };
}

export default async function DynamicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedSitePage(slug);
  if (!page) notFound();
  const settings = await getSettings();
  return <SitePageRenderer page={page as SitePageData} settings={settings} />;
}
