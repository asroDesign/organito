import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, BookOpen, Hash, Leaf, Search, Sparkles } from "lucide-react";
import { BlogCard, type BlogCardPost } from "@/components/BlogCard";
import { Img } from "@/components/ui";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
import { getPublishedBlogIndex } from "@/lib/public-content-cache";
import { siteBrandText } from "@/lib/brand";
import { stripHtml } from "@/lib/html";
import { jdate } from "@/lib/util";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return seoMetadata(s, { title: s.blogSeoTitle, description: s.blogSeoDescription, keywords: s.blogSeoKeywords, path: "/blog" });
}

function readMinutes(content: string) {
  return Math.max(1, Math.ceil(stripHtml(content, 100000).split(/\s+/).length / 220));
}

function SectionTitle({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-3">
    <div><span className="text-[11px] font-black tracking-[.18em] text-amber-700">{eyebrow}</span><h2 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">{title}</h2></div>
    {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-800 hover:text-amber-800">همه مطالب<ArrowLeft className="size-4" /></Link>}
  </div>;
}

function LeadStory({ post, siteName }: { post: BlogCardPost; siteName: string }) {
  const title = siteBrandText(post.title, siteName);
  const excerpt = siteBrandText(post.excerpt, siteName) || stripHtml(siteBrandText(post.content, siteName), 200);
  return <article className="group overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-[0_24px_70px_-42px_rgba(74,55,13,.55)] lg:grid lg:grid-cols-[1.12fr_.88fr]">
    <Link href={`/blog/${post.slug}`} aria-label={`مطالعه ${title}`} className="relative block min-h-72 overflow-hidden bg-emerald-100 sm:min-h-96 lg:order-2">
      {post.coverImageId ? <Img id={post.coverImageId} alt={title} className="absolute inset-0 size-full transition duration-700 group-hover:scale-[1.035]" sizes="(max-width: 1024px) 100vw, 55vw" /> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_30%,#fef3c7,transparent_40%),linear-gradient(135deg,#d9f99d,#a7f3d0)]"><Leaf className="size-24 text-emerald-800/50" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 via-transparent to-transparent lg:bg-gradient-to-l lg:from-transparent lg:via-transparent lg:to-emerald-950/10" />
      <span className="absolute right-5 top-5 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black text-amber-950 shadow-sm">روایت تازه</span>
      <div className="absolute bottom-5 right-5 left-5 flex items-center justify-between text-xs font-medium text-white lg:hidden"><span>{post.category}</span><span>{jdate(post.publishedAt)}</span></div>
    </Link>
    <div className="flex flex-col justify-center p-6 sm:p-9 lg:order-1 lg:p-12">
      <span className="mb-4 flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><Sparkles className="size-3.5" />{siteBrandText(post.category, siteName)}</span>
      <Link href={`/blog/${post.slug}`}><h2 className="text-balance text-2xl font-black leading-[1.7] text-slate-950 transition group-hover:text-emerald-900 sm:text-3xl">{title}</h2></Link>
      <p className="mt-4 line-clamp-3 text-sm leading-8 text-slate-600">{excerpt}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-slate-100 pt-5 text-xs text-slate-500">
        {post.author && <span className="flex items-center gap-2 font-bold text-slate-700">{post.authorAvatar ? <Img id={post.authorAvatar} alt={post.author} className="size-8 rounded-full" sizes="32px" /> : <span className="grid size-8 place-items-center rounded-full bg-amber-100 font-black text-amber-900">{post.author.slice(0, 1)}</span>}{post.author}</span>}
        <span className="hidden h-4 border-r border-slate-200 lg:block" />
        <span>{jdate(post.publishedAt)}</span><span>{readMinutes(post.content).toLocaleString("fa-IR")} دقیقه مطالعه</span>
      </div>
      <Link href={`/blog/${post.slug}`} className="mt-7 inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800">خواندن مقاله<ArrowUpLeft className="size-4" /></Link>
    </div>
  </article>;
}

function SmallStory({ post, index, siteName }: { post: BlogCardPost; index: number; siteName: string }) {
  const title = siteBrandText(post.title, siteName);
  return <article className="group flex min-w-0 gap-4 border-b border-slate-200 py-4 last:border-0">
    <span className="pt-1 font-serif text-2xl font-black text-amber-600/70">{String(index + 1).padStart(2, "0")}</span>
    <div className="min-w-0 flex-1"><Link href={`/blog/${post.slug}`} className="line-clamp-2 font-bold leading-7 text-slate-800 transition group-hover:text-emerald-800">{title}</Link><div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500"><span>{siteBrandText(post.category, siteName)}</span><span>{jdate(post.publishedAt)}</span></div></div>
  </article>;
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  const { posts: all, tags, categories } = await getPublishedBlogIndex();
  const q = (sp.q ?? "").trim().toLowerCase();
  const posts = all.filter((p) => (!sp.cat || p.category === sp.cat) && (!q || `${p.title} ${p.excerpt ?? ""} ${p.tags.join(" ")}`.toLowerCase().includes(q)));
  const base = siteBase(s.siteUrl);
  const hotTags = tags.map((tag) => ({ ...tag, count: all.filter((post) => post.tags.includes(tag.name)).length })).sort((a, b) => b.count - a.count).slice(0, 12);
  const lead = posts[0];
  const catCounts = new Map<string, number>();
  for (const post of all) catCounts.set(post.category, (catCounts.get(post.category) ?? 0) + 1);
  const sections = categories.map((category) => ({ category, posts: posts.filter((post) => post.category === category).slice(0, 4) })).filter((section) => section.posts.length);

  return <><SiteHeader /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "Blog", name: s.blogSeoTitle, description: s.blogSeoDescription, url: new URL("/blog", base).toString(), blogPost: posts.slice(0, 10).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: new URL(`/blog/${p.slug}`, base).toString(), datePublished: p.publishedAt?.toISOString() })) }) }} />
    <main className="blog-page-surface min-h-screen bg-[#fbfaf6]">
      <section className="blog-hero-surface relative isolate overflow-hidden border-b border-amber-100 bg-[#fff9e8]">
        <div aria-hidden="true" className="absolute -left-28 -top-36 -z-10 size-[30rem] rounded-full border-[1px] border-amber-300/50" />
        <div aria-hidden="true" className="absolute -left-12 -top-20 -z-10 size-[22rem] rounded-full border-[1px] border-amber-300/40" />
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_auto] lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-emerald-900"><Leaf className="size-4 text-emerald-700" />مجلهٔ زندگی سالم و انتخاب آگاهانه</div>
            <h1 className="text-balance text-3xl font-black leading-[1.55] text-emerald-950 sm:text-4xl lg:text-5xl">از زمین تا سفره،<br className="hidden sm:block" /> داستان انتخاب‌های سالم</h1>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">دانستنی‌های محصولات ارگانیک، تغذیه، کشاورزی پایدار و سبک زندگی طبیعی را از نگاه نویسندگان مجلهٔ {s.siteName} بخوانید.</p>
            <form action="/blog" className="mt-7 flex max-w-xl gap-2 rounded-2xl border border-amber-200 bg-white p-1.5 shadow-sm focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100/70">
              <label className="relative flex min-w-0 flex-1 items-center"><Search className="absolute right-3 size-4 text-slate-400" /><input name="q" defaultValue={sp.q} className="h-11 w-full rounded-xl bg-transparent pr-10 pl-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" placeholder="جست‌وجو در مقاله‌ها و موضوع‌ها" aria-label="جست‌وجو در مجله" />{sp.cat && <input type="hidden" name="cat" value={sp.cat} />}</label>
              <button className="shrink-0 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 sm:px-6">جست‌وجو</button>
            </form>
          </div>
          <div className="hidden h-48 w-48 items-center justify-center rounded-full border border-amber-200 bg-[radial-gradient(circle,#fff_0%,#fff5ce_55%,#f6e3a2_100%)] shadow-[0_25px_70px_-45px_rgba(92,69,14,.55)] lg:flex"><div className="grid size-32 place-items-center rounded-full border border-emerald-800/10 bg-white/80"><Leaf className="size-16 text-emerald-800" strokeWidth={1.2} /></div></div>
        </div>
      </section>

      <nav aria-label="دسته‌بندی‌های مجله" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3.5 [scrollbar-width:none] sm:px-6">
          <Link href="/blog" className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${!sp.cat ? "bg-emerald-950 text-white" : "bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-900"}`}>همهٔ موضوع‌ها <span className="mr-1 opacity-70">{all.length.toLocaleString("fa-IR")}</span></Link>
          {categories.map((category) => <Link key={category} href={`/blog?cat=${encodeURIComponent(category)}`} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${sp.cat === category ? "bg-emerald-950 text-white" : "bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-900"}`}>{siteBrandText(category, s.siteName)} <span className="mr-1 opacity-60">{(catCounts.get(category) ?? 0).toLocaleString("fa-IR")}</span></Link>)}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-9 sm:px-6 sm:py-12">
        {lead ? <>
          <section><SectionTitle eyebrow="سردبیر پیشنهاد می‌کند" title="برای شروع از اینجا بخوانید" /><div className="grid gap-6 lg:grid-cols-[1.65fr_.75fr]"><LeadStory post={lead} siteName={s.siteName} /><aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-1 flex items-center gap-2 text-xs font-black text-amber-700"><BookOpen className="size-4" />خواندنی‌های تازه</div><div className="divide-y divide-slate-100">{posts.slice(1, 5).map((post, i) => <SmallStory key={post.id} post={post} index={i} siteName={s.siteName} />)}</div><Link href="/blog" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-3 text-xs font-bold text-amber-950 transition hover:bg-amber-100">ورق زدن مجله<ArrowLeft className="size-4" /></Link></aside></div></section>

          {posts.length > 1 && <section><SectionTitle eyebrow="تازه منتشر شده" title="تازه‌های مجله" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.slice(1, 4).map((post) => <BlogCard key={post.id} post={post} siteName={s.siteName} />)}</div></section>}

          {sections.slice(0, 3).map(({ category, posts: categoryPosts }, index) => <section key={category}>
            <SectionTitle eyebrow={`پروندهٔ ${String(index + 1).padStart(2, "0")}`} title={siteBrandText(category, s.siteName)} href={`/blog?cat=${encodeURIComponent(category)}`} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{categoryPosts.map((post) => <BlogCard key={post.id} post={post} siteName={s.siteName} />)}</div>
          </section>)}

          {hotTags.length > 0 && <section className="overflow-hidden rounded-[2rem] bg-emerald-950 px-6 py-7 text-white sm:px-9 sm:py-9"><div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><div className="flex items-center gap-2 text-xs font-bold text-amber-300"><Hash className="size-4" />گفت‌وگوهای داغ مجله</div><h2 className="mt-2 text-2xl font-black">از کدام موضوع شروع کنیم؟</h2><p className="mt-2 text-sm leading-7 text-emerald-100/80">موضوع‌های پرمقاله را دنبال کنید و نوشته‌های مرتبط را یکجا ببینید.</p></div><div className="flex flex-wrap gap-2">{hotTags.map((tag) => <Link key={tag.slug} href={`/blog/tag/${tag.slug}`} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:border-amber-300/60 hover:bg-amber-300 hover:text-emerald-950"># {tag.name}</Link>)}</div></div></section>}

          {posts.length > 4 && <section><SectionTitle eyebrow="یک پیشنهاد دیگر" title="شاید این‌ها را هم دوست داشته باشید" /><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.slice(4, 7).map((post) => <BlogCard key={post.id} post={post} siteName={s.siteName} />)}</div></section>}
        </> : <section className="rounded-[2rem] border border-dashed border-amber-300 bg-white px-6 py-20 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-50 text-amber-800"><Search className="size-7" /></span><h2 className="mt-4 text-xl font-black text-slate-900">مقاله‌ای پیدا نشد</h2><p className="mt-2 text-sm text-slate-500">موضوع یا عبارت جست‌وجو را تغییر دهید.</p><Link href="/blog" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white">نمایش همهٔ مقاله‌ها<ArrowLeft className="size-4" /></Link></section>}
      </div>
    </main><SiteFooter /></>;
}
