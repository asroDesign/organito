import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { ArrowRight, PackageSearch, Tags } from "lucide-react";
import { db } from "@/db";
import { blogPosts, products } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { seoMetadata, siteBase } from "@/lib/seo";
import { listShopProducts } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { BlogCard } from "@/components/BlogCard";
import { RichContent } from "@/components/RichContent";
import { Img } from "@/components/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getPublicBrand } from "@/lib/public-brand-cache";

async function findBrand(slug: string) { return getPublicBrand(slug); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const brand = await findBrand((await params).slug);
  if (!brand) return { title: "برند پیدا نشد" };
  const settings = await getSettings(), title = brand.seoTitle || `${brand.name} | ${settings.siteName}`, description = brand.metaDescription || brand.description?.replace(/<[^>]*>/g, " ").slice(0, 300) || `محصولات و راهنماهای برند ${brand.name}`;
  const imageId = brand.bannerMediaId ?? brand.logoMediaId;
  return seoMetadata(settings, { title, description, keywords: brand.seoKeywords, path: `/brands/${brand.slug}`, canonical: brand.canonicalUrl, imageId });
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const brand = await findBrand((await params).slug);
  if (!brand) notFound();
  const normalized = sql`lower(regexp_replace(btrim(${products.brand}), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(${brand.name}), '\\s+', ' ', 'g'))`;
  const productRows = await db.select({ id: products.id }).from(products).where(and(normalized, inArray(products.status, ["active", "out_of_stock"]))).orderBy(desc(products.updatedAt)).limit(100);
  const productsList = productRows.length ? await listShopProducts({ ids: productRows.map((x) => x.id) }, 100) : [];
  const relatedPosts = brand.relatedBlogPostIds.length ? await db.select().from(blogPosts).where(and(inArray(blogPosts.id, brand.relatedBlogPostIds), eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))).orderBy(desc(blogPosts.publishedAt)) : [];
  const settings = await getSettings();
  const canonical = brand.canonicalUrl || new URL(`/brands/${brand.slug}`, siteBase(settings.siteUrl)).toString();
  const structured = { "@context": "https://schema.org", "@type": "Brand", name: brand.name, url: canonical, ...(brand.logoMediaId ? { logo: new URL(`/api/media/${brand.logoMediaId}`, siteBase(settings.siteUrl)).toString() } : {}), ...(brand.description ? { description: brand.description.replace(/<[^>]*>/g, " ").slice(0, 500) } : {}) };
  return <><SiteHeader/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/><main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
    <nav className="flex items-center gap-2 text-xs text-slate-500"><Link href="/">خانه</Link><span>/</span><Link href="/brands">برندها</Link><span>/</span><span className="text-emerald-800">{brand.name}</span></nav>
    <header className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-800 text-white shadow-lg">{brand.bannerMediaId&&<div className="absolute inset-0 -z-10 opacity-25"><Img id={brand.bannerMediaId} alt="" className="size-full"/></div>}<div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-9"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/20 bg-white p-2 shadow-xl">{brand.logoMediaId?<Img id={brand.logoMediaId} alt={brand.name} className="size-full"/>:<Tags className="size-10 text-emerald-800"/>}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-lime-300">معرفی برند</p><h1 className="mt-1 text-3xl font-black">{brand.name}</h1><p className="mt-2 text-sm text-emerald-100">{productsList.length.toLocaleString("fa-IR")} محصول از این برند</p></div><Link href="/brands" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/20 hover:bg-white/15"><ArrowRight className="size-4"/>همه برندها</Link></div></header>
    {brand.description&&<section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7"><h2 className="mb-3 text-xl font-black text-emerald-950">دربارهٔ {brand.name}</h2><RichContent content={brand.description}/></section>}
    <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-emerald-950">محصولات {brand.name}</h2><p className="mt-1 text-sm text-slate-500">قیمت و موجودی به‌روز محصولات این برند</p></div></div>{productsList.length?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{productsList.map((p)=><ProductCard key={p.id} p={p}/>)}</div>:<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"><PackageSearch className="mx-auto mb-3 size-8 text-slate-300"/>محصول فعالی برای این برند ثبت نشده است.</div>}</section>
    {relatedPosts.length>0&&<section><h2 className="mb-4 text-2xl font-black text-emerald-950">راهنماهای مرتبط</h2><div className="grid gap-4 md:grid-cols-2">{relatedPosts.map((post)=><BlogCard key={post.id} post={post} siteName={settings.siteName}/>)}</div></section>}
  </main><SiteFooter/></>;
}
