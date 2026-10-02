import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, lte } from "drizzle-orm";
import { BookOpen, Search } from "lucide-react";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { BlogCard } from "@/components/BlogCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> { const s = await getSettings(); return seoMetadata(s, { title: s.blogSeoTitle, description: s.blogSeoDescription, keywords: s.blogSeoKeywords, path: "/blog" }); }

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  const all = await db.select().from(blogPosts).where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))).orderBy(desc(blogPosts.publishedAt));
  const categories = Array.from(new Set(all.map((p) => p.category)));
  const q = (sp.q ?? "").trim().toLowerCase();
  const posts = all.filter((p) => (!sp.cat || p.category === sp.cat) && (!q || `${p.title} ${p.excerpt ?? ""} ${p.tags.join(" ")}`.toLowerCase().includes(q)));
  const base = siteBase(s.siteUrl);
  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "Blog", name: s.blogSeoTitle, description: s.blogSeoDescription, url: new URL("/blog", base).toString(), blogPost: posts.slice(0, 10).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: new URL(`/blog/${p.slug}`, base).toString(), datePublished: p.publishedAt?.toISOString() })) }) }} />
    <section className="border-b bg-gradient-to-bl from-emerald-950 via-emerald-900 to-lime-800 text-white"><div className="mx-auto max-w-7xl px-4 py-14"><span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs"><BookOpen className="h-4 w-4" />مجله تخصصی {s.siteName}</span><h1 className="text-3xl font-black md:text-5xl">دانش سالم برای انتخاب آگاهانه</h1><p className="mt-4 max-w-2xl leading-8 text-emerald-100">راهنمای علمی و کاربردی تغذیه سالم، محصولات ارگانیک، کشاورزی پایدار و سبک زندگی طبیعی.</p><form className="mt-6 flex max-w-xl gap-2"><div className="relative flex-1"><Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" /><input name="q" defaultValue={sp.q} className="input pr-10 text-slate-900" placeholder="جست‌وجو در مقاله‌ها…" /></div><button className="rounded-xl bg-lime-400 px-5 font-bold text-emerald-950">جست‌وجو</button></form></div></section>
    <main className="mx-auto max-w-7xl px-4 py-10"><nav className="mb-7 flex flex-wrap gap-2"><Link href="/blog" className={!sp.cat ? "btn-primary" : "btn-ghost"}>همه مطالب</Link>{categories.map((cat) => <Link key={cat} href={`/blog?cat=${encodeURIComponent(cat)}`} className={sp.cat === cat ? "btn-primary" : "btn-ghost"}>{cat}</Link>)}</nav>{posts.length ? <><BlogCard post={posts[0]} featured siteName={s.siteName} /><div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{posts.slice(1).map((post) => <BlogCard key={post.id} post={post} siteName={s.siteName} />)}</div></> : <div className="rounded-3xl border border-dashed bg-white p-16 text-center text-slate-500">مقاله‌ای با این مشخصات یافت نشد.</div>}</main><SiteFooter /></>;
}
