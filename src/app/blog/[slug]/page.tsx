import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, Leaf, Tag } from "lucide-react";
import { db } from "@/db";
import { blogTags } from "@/db/schema";
import { BlogCard } from "@/components/BlogCard";
import { BlogShareActions } from "@/components/BlogShareActions";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Img } from "@/components/ui";
import { stripHtml } from "@/lib/html";
import { RichContent } from "@/components/RichContent";
import { getSettings } from "@/lib/settings";
import { siteBrandText } from "@/lib/brand";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
import { jdate, slugify } from "@/lib/util";
import { getPublishedBlogPost, getRelatedPublishedBlogPosts } from "@/lib/public-content-cache";

async function getPost(slug: string) { return getPublishedBlogPost(slug); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [row, s] = await Promise.all([getPost(slug), getSettings()]);
  if (!row) return {};
  const p = row.post;
  return seoMetadata(s, { title: siteBrandText(p.seoTitle || p.title, s.siteName), description: siteBrandText(p.metaDescription || p.excerpt || stripHtml(p.content, 160), s.siteName), keywords: p.tags.join(","), path: `/blog/${p.slug}`, canonical: p.canonicalUrl, imageId: p.coverImageId, type: "article", publishedTime: p.publishedAt?.toISOString(), modifiedTime: p.updatedAt.toISOString() });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row, s] = await Promise.all([getPost(slug), getSettings()]);
  if (!row) notFound();
  const p = row.post;
  const title = siteBrandText(p.title, s.siteName);
  const excerpt = siteBrandText(p.excerpt, s.siteName);
  const category = siteBrandText(p.category, s.siteName);
  const content = siteBrandText(p.content, s.siteName);
  const [related, tagRows] = await Promise.all([
    getRelatedPublishedBlogPosts(p.category, p.id),
    p.tags.length ? db.select({ name: blogTags.name, slug: blogTags.slug }).from(blogTags).where(inArray(blogTags.name, p.tags)) : Promise.resolve([]),
  ]);
  const tagSlugs = new Map(tagRows.map((tag) => [tag.name, tag.slug]));
  const minutes = Math.max(1, Math.ceil(stripHtml(p.content, 100000).split(/\s+/).length / 220));
  const base = siteBase(s.siteUrl);
  const url = new URL(`/blog/${p.slug}`, base).toString();
  const author = row.author || s.siteName;

  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: siteBrandText(p.metaDescription || p.excerpt, s.siteName), image: p.coverImageId ? new URL(`/api/media/${p.coverImageId}`, base).toString() : undefined, datePublished: p.publishedAt?.toISOString(), dateModified: p.updatedAt.toISOString(), author: { "@type": "Person", name: author }, publisher: { "@type": "Organization", name: s.siteName }, mainEntityOfPage: url }) }} />
    <main className="blog-page-surface min-h-screen bg-[#fbfaf6]">
      <div className="blog-hero-surface border-b border-amber-100 bg-[#fff9e8]">
        <div className="mx-auto max-w-7xl px-4 pb-9 pt-5 sm:px-6 sm:pb-12">
          <nav aria-label="مسیر صفحه" className="mb-7 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Link href="/" className="transition hover:text-emerald-800">خانه</Link><span>/</span><Link href="/blog" className="transition hover:text-emerald-800">مجلهٔ {s.siteName}</Link><span>/</span><Link href={`/blog?cat=${encodeURIComponent(p.category)}`} className="text-emerald-800">{category}</Link></nav>
          <div className="mx-auto max-w-4xl text-center">
            <Link href={`/blog?cat=${encodeURIComponent(p.category)}`} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-3 py-1.5 text-xs font-bold text-emerald-900"><Leaf className="size-3.5" />{category}</Link>
            <h1 className="mt-5 text-balance text-3xl font-black leading-[1.65] text-emerald-950 sm:text-4xl lg:text-[2.8rem]">{title}</h1>
            {excerpt && <p className="mx-auto mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">{excerpt}</p>}
            <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs text-slate-600 sm:justify-start">
                <span className="flex items-center gap-2 font-bold text-slate-800">{row.authorAvatar ? <Img id={row.authorAvatar} alt={author} className="size-10 rounded-full border-2 border-white shadow-sm" sizes="40px" /> : <span className="grid size-10 place-items-center rounded-full border-2 border-white bg-amber-200 font-black text-amber-950 shadow-sm">{author.slice(0, 1)}</span>}<span>{author}<small className="mt-0.5 block font-normal text-slate-500">نویسندهٔ مجله</small></span></span>
                <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-amber-700" />{jdate(p.publishedAt)}</span>
                <span className="flex items-center gap-1.5"><Clock3 className="size-4 text-amber-700" />{minutes.toLocaleString("fa-IR")} دقیقه مطالعه</span>
              </div>
              <BlogShareActions title={title} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {p.coverImageId && <figure className="relative mx-auto mb-8 max-w-6xl overflow-hidden rounded-[1.75rem] border border-white bg-emerald-100 shadow-[0_24px_70px_-42px_rgba(36,55,38,.55)] sm:mb-10 sm:rounded-[2rem]"> <Img id={p.coverImageId} alt={title} className="aspect-[16/8] max-h-[620px] w-full" sizes="(max-width: 1280px) 100vw, 1200px" /><figcaption className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-700 backdrop-blur">مجلهٔ {s.siteName}</figcaption></figure>}

        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
          <article className="min-w-0 rounded-[1.75rem] border border-slate-200/80 bg-white px-5 py-7 shadow-[0_20px_60px_-50px_rgba(15,23,42,.5)] sm:px-9 sm:py-10 lg:px-12">
            {p.contentType === "video" && p.videoMediaId && <video src={`/api/media/${p.videoMediaId}`} controls playsInline preload="metadata" className="mb-8 aspect-video w-full rounded-2xl bg-black" aria-label={`ویدیوی ${title}`} />}
            {p.contentType === "audio" && p.audioMediaId && <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5"><b className="mb-3 block text-emerald-950">شنیدن فایل صوتی مقاله</b><audio src={`/api/media/${p.audioMediaId}`} controls preload="metadata" className="w-full" aria-label={`فایل صوتی ${title}`} /></div>}
            {content && <div className="prose-rich max-w-none text-[15px] leading-[2.2] text-slate-700 sm:text-base"><RichContent content={content} /></div>}
            {p.tags.length > 0 && <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-6"><Tag className="size-4 text-amber-700" />{p.tags.map((tag) => <Link key={tag} href={`/blog/tag/${tagSlugs.get(tag) || slugify(tag)}`} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100">{tag}</Link>)}</div>}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-950 p-5 text-white sm:p-6"><div><span className="text-xs font-bold text-amber-300">دانسته‌های بیشتر، انتخاب بهتر</span><p className="mt-1 text-sm leading-6 text-emerald-50">مقاله‌های دیگر مجلهٔ {s.siteName} را بخوانید.</p></div><Link href="/blog" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-black text-emerald-950 transition hover:bg-amber-200">بازگشت به مجله<ArrowLeft className="size-4" /></Link></div>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-[1.5rem] border border-amber-100 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-amber-100 text-lg font-black text-amber-950">{row.authorAvatar ? <Img id={row.authorAvatar} alt={author} className="size-full" sizes="48px" /> : author.slice(0, 1)}</div><div><span className="text-[10px] font-bold text-amber-700">دربارهٔ نویسنده</span><h2 className="mt-0.5 font-black text-slate-900">{author}</h2></div></div><p className="mt-4 text-xs leading-7 text-slate-600">این مقاله در مجلهٔ {s.siteName} منتشر شده تا مسیر انتخاب محصولات سالم و زندگی آگاهانه روشن‌تر شود.</p><div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><CalendarDays className="size-4 text-amber-700" />انتشار: {jdate(p.publishedAt)}</div></section>
            {related.length > 0 && <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-3"><span className="text-[10px] font-black tracking-widest text-amber-700">ادامهٔ مطالعه</span><h2 className="mt-1 text-lg font-black text-slate-900">شاید بخوانید</h2></div><div className="divide-y divide-slate-100">{related.map((post) => <Link key={post.id} href={`/blog/${post.slug}`} className="group flex gap-3 py-3 first:pt-0 last:pb-0"><div className="size-[76px] shrink-0 overflow-hidden rounded-xl bg-emerald-50">{post.coverImageId ? <Img id={post.coverImageId} alt={post.title} className="size-full transition group-hover:scale-105" sizes="76px" /> : <div className="grid size-full place-items-center"><Leaf className="size-6 text-emerald-700" /></div>}</div><div className="min-w-0"><span className="text-[10px] font-bold text-emerald-800">{siteBrandText(post.category, s.siteName)}</span><h3 className="mt-1 line-clamp-3 text-xs font-bold leading-6 text-slate-800 transition group-hover:text-emerald-800">{siteBrandText(post.title, s.siteName)}</h3><span className="mt-1 block text-[10px] text-slate-400">{jdate(post.publishedAt)}</span></div></Link>)}</div></section>}
          </aside>
        </div>

        {related.length > 0 && <section className="mx-auto mt-14 max-w-6xl"><div className="mb-5 flex items-end justify-between"><div><span className="text-[11px] font-black tracking-[.16em] text-amber-700">بیشتر از همین موضوع</span><h2 className="mt-1 text-2xl font-black text-emerald-950">مطالب مرتبط</h2></div><Link href={`/blog?cat=${encodeURIComponent(p.category)}`} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">همهٔ این دسته<ArrowLeft className="size-4" /></Link></div><div className="grid gap-5 md:grid-cols-3">{related.map((post) => <BlogCard key={post.id} post={post} siteName={s.siteName} />)}</div></section>}
      </div>
    </main><SiteFooter /></>;
}
