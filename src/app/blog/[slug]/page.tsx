import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, lte, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, Tag } from "lucide-react";
import { db } from "@/db";
import { blogPosts, users } from "@/db/schema";
import { BlogCard } from "@/components/BlogCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Img } from "@/components/ui";
import { sanitizeRich, stripHtml } from "@/lib/html";
import { getSettings } from "@/lib/settings";
import { siteBrandText } from "@/lib/brand";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
import { jdate } from "@/lib/util";

async function getPost(slug: string) { const [row] = await db.select({ post: blogPosts, author: users.name }).from(blogPosts).leftJoin(users, eq(users.id, blogPosts.authorId)).where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))).limit(1); return row; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const [row, s] = await Promise.all([getPost(slug), getSettings()]); if (!row) return {}; const p = row.post; return seoMetadata(s, { title: siteBrandText(p.seoTitle || p.title, s.siteName), description: siteBrandText(p.metaDescription || p.excerpt || stripHtml(p.content, 160), s.siteName), keywords: p.tags.join(","), path: `/blog/${p.slug}`, canonical: p.canonicalUrl, imageId: p.coverImageId, type: "article", publishedTime: p.publishedAt?.toISOString(), modifiedTime: p.updatedAt.toISOString() }); }

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const [row, s] = await Promise.all([getPost(slug), getSettings()]); if (!row) notFound(); const p = row.post;
  const brandedTitle=siteBrandText(p.title,s.siteName), brandedExcerpt=siteBrandText(p.excerpt,s.siteName), brandedCategory=siteBrandText(p.category,s.siteName), brandedContent=siteBrandText(p.content,s.siteName);
  const related = await db.select().from(blogPosts).where(and(eq(blogPosts.status, "published"), eq(blogPosts.category, p.category), ne(blogPosts.id, p.id), lte(blogPosts.publishedAt, new Date()))).orderBy(desc(blogPosts.publishedAt)).limit(3);
  const minutes = Math.max(1, Math.ceil(stripHtml(p.content, 100000).split(/\s+/).length / 220)); const base = siteBase(s.siteUrl); const url = new URL(`/blog/${p.slug}`, base).toString();
  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "BlogPosting", headline: brandedTitle, description: siteBrandText(p.metaDescription || p.excerpt,s.siteName), image: p.coverImageId ? new URL(`/api/media/${p.coverImageId}`, base).toString() : undefined, datePublished: p.publishedAt?.toISOString(), dateModified: p.updatedAt.toISOString(), author: { "@type": "Person", name: row.author || s.siteName }, publisher: { "@type": "Organization", name: s.siteName }, mainEntityOfPage: url }) }} />
    <main><div className="border-b bg-emerald-50"><div className="mx-auto max-w-4xl px-4 py-10"><nav className="mb-4 text-xs text-slate-500"><Link href="/">خانه</Link> / <Link href="/blog">وبلاگ</Link> / {brandedCategory}</nav><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">{brandedCategory}</span><h1 className="mt-4 text-balance text-3xl font-black leading-[1.5] text-emerald-950 md:text-5xl">{brandedTitle}</h1><p className="mt-4 text-lg leading-9 text-slate-600">{brandedExcerpt}</p><div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-500"><span>{row.author || s.siteName}</span><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{jdate(p.publishedAt)}</span><span className="flex items-center gap-1"><Clock3 className="h-4 w-4" />{minutes.toLocaleString("fa-IR")} دقیقه مطالعه</span></div></div></div>
      <article className="mx-auto max-w-4xl px-4 py-10">{p.coverImageId && <Img id={p.coverImageId} alt={p.title} className="mb-8 aspect-[16/8] w-full rounded-3xl" />}<div className="prose prose-slate max-w-none leading-9 prose-headings:text-emerald-950 prose-a:text-emerald-700" dangerouslySetInnerHTML={{ __html: sanitizeRich(brandedContent) }} />{p.tags.length > 0 && <div className="mt-10 flex flex-wrap items-center gap-2 border-t pt-6"><Tag className="h-4 w-4 text-slate-400" />{p.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag}</span>)}</div>}</article>
      {related.length > 0 && <section className="mx-auto max-w-7xl px-4 pb-12"><h2 className="mb-5 text-2xl font-black text-emerald-950">مطالب مرتبط</h2><div className="grid gap-6 md:grid-cols-3">{related.map((post) => <BlogCard key={post.id} post={post} siteName={s.siteName} />)}</div></section>}</main><SiteFooter /></>;
}
