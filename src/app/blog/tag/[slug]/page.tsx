import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Tag as TagIcon } from "lucide-react";
import { BlogCard } from "@/components/BlogCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { siteBrandText } from "@/lib/brand";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
import { getPublishedBlogTagArchive } from "@/lib/public-content-cache";

function archiveDescription(tagName: string, siteName: string) {
  return `مقاله‌ها و راهنماهای ${tagName}؛ تازه‌ترین مطالب و نکته‌های کاربردی در مجله ${siteName}.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [{ tag, posts }, settings] = await Promise.all([getPublishedBlogTagArchive(slug), getSettings()]);
  if (!tag) return {};
  if (!posts.length) return { robots: { index: false, follow: true } };
  const title = siteBrandText(tag.seoTitle || `مقاله‌های ${tag.name}`, settings.siteName);
  const description = siteBrandText(tag.metaDescription || archiveDescription(tag.name, settings.siteName), settings.siteName);
  return seoMetadata(settings, {
    title, description, keywords: tag.seoKeywords || tag.name,
    path: `/blog/tag/${tag.slug}`, canonical: tag.canonicalUrl,
  });
}

export default async function BlogTagArchivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ tag, posts }, settings] = await Promise.all([getPublishedBlogTagArchive(slug), getSettings()]);
  const displayTag = tag ?? { id: 0, name: decodeURIComponent(slug).replaceAll("-", " "), slug, seoTitle: null, metaDescription: null, seoKeywords: null, canonicalUrl: null, createdAt: new Date(0), updatedAt: new Date(0) };
  const base = siteBase(settings.siteUrl);
  const path = `/blog/tag/${displayTag.slug}`;
  const title = siteBrandText(displayTag.seoTitle || `مقاله‌های ${displayTag.name}`, settings.siteName);
  const description = siteBrandText(displayTag.metaDescription || archiveDescription(displayTag.name, settings.siteName), settings.siteName);
  const url = displayTag.canonicalUrl || new URL(path, base).toString();
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url,
    isPartOf: { "@type": "Blog", name: settings.blogSeoTitle || `مجله ${settings.siteName}`, url: new URL("/blog", base).toString() },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.slice(0, 20).map((post, index) => ({
        "@type": "ListItem", position: index + 1,
        url: new URL(`/blog/${post.slug}`, base).toString(), name: post.title,
      })),
    },
  };
  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jsonLdData) }} />
    <section className="border-b bg-gradient-to-bl from-emerald-950 via-emerald-900 to-lime-800 text-white"><div className="mx-auto max-w-7xl px-4 py-12">
      <nav className="mb-5 text-sm text-emerald-100"><Link href="/">خانه</Link><span className="mx-2">/</span><Link href="/blog">وبلاگ</Link><span className="mx-2">/</span><span>{displayTag.name}</span></nav>
      <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs"><BookOpen className="h-4 w-4" />مجله تخصصی {settings.siteName}</span>
      <h1 className="text-3xl font-black md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-3xl leading-8 text-emerald-100">{description}</p>
      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm"><TagIcon className="size-4" />{posts.length.toLocaleString("fa-IR")} مقاله دربارهٔ {displayTag.name}</p>
    </div></section>
    <main className="mx-auto max-w-7xl px-4 py-10"><div className="mb-7 flex items-center justify-between gap-4"><Link href="/blog" className="btn-ghost">بازگشت به همه مقاله‌ها</Link><span className="text-sm text-slate-500">مرتب‌شده بر اساس جدیدترین انتشار</span></div>
      {posts.length ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <BlogCard key={post.id} post={post} siteName={settings.siteName} />)}</div> : <div className="rounded-3xl border border-dashed bg-white p-16 text-center text-slate-500">هنوز مقاله‌ای برای این برچسب منتشر نشده است.</div>}
    </main><SiteFooter /></>;
}
