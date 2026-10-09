import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomePublicContent } from "@/components/HomePublicContent";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-page-builder";
import { identifyBlocks } from "@/lib/page-builder";
import { getHomeData } from "@/lib/home-data";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
import { getActiveStories } from "@/lib/stories";
import { StoryRail } from "@/components/StoryRail";
import { getPublishedSitePage } from "@/lib/public-content-cache";
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const page = await getPublishedSitePage("home");
  return seoMetadata(s, { title: page?.metaTitle || s.homeSeoTitle, description: page?.metaDescription || s.homeSeoDescription, keywords: s.homeSeoKeywords, path: "/" });
}

export default async function Home() {
  await ensureSeeded();
  const page = await getPublishedSitePage("home");
  const blocks = identifyBlocks(page?.blocks ?? DEFAULT_HOME_LAYOUT);
  const [data, st, stories] = await Promise.all([getHomeData(blocks), getSettings(), getActiveStories()]);
  const storyCards = stories.map(({ story, productName, productSlug }) => ({ id: story.id, title: story.title, caption: story.caption, mediaId: story.mediaId, mediaType: story.mediaType as "image" | "video", productName, productSlug, href: story.href, ctaLabel: story.ctaLabel, viewCount: story.viewCount, likeCount: story.likeCount }));
  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "OnlineStore", name: st.siteName, description: page?.metaDescription || st.homeSeoDescription, url: siteBase(st.siteUrl).toString(), telephone: st.supportPhone, currenciesAccepted: "IRR" }) }}/><StoryRail stories={storyCards}/><HomePublicContent blocks={blocks} data={data} /><SiteFooter /></>;
}
