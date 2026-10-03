import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeContent } from "@/components/HomeContent";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-page-builder";
import { identifyBlocks } from "@/lib/page-builder";
import { getHomeData } from "@/lib/home-data";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const [page] = await db.select({ metaTitle: contentPages.metaTitle, metaDescription: contentPages.metaDescription }).from(contentPages).where(and(eq(contentPages.slug, "home"), eq(contentPages.status, "published")));
  return seoMetadata(s, { title: page?.metaTitle || s.homeSeoTitle, description: page?.metaDescription || s.homeSeoDescription, keywords: s.homeSeoKeywords, path: "/" });
}

export default async function Home() {
  await ensureSeeded();
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, "home"), eq(contentPages.status, "published")));
  const blocks = identifyBlocks(page?.blocks ?? DEFAULT_HOME_LAYOUT);
  const [data, st] = await Promise.all([getHomeData(blocks), getSettings()]);
  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "OnlineStore", name: st.siteName, description: page?.metaDescription || st.homeSeoDescription, url: siteBase(st.siteUrl).toString(), telephone: st.supportPhone, currenciesAccepted: "IRR" }) }}/><HomeContent blocks={blocks} data={data} /><SiteFooter /></>;
}
