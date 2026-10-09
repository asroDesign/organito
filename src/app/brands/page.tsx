import type { Metadata } from "next";
import Link from "next/link";
import { getPublicBrandIndex } from "@/lib/public-brand-cache";
import { getSettings } from "@/lib/settings";
import { seoMetadata } from "@/lib/seo";
import { Img } from "@/components/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Tags } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = `برندهای محصولات | ${s.siteName}`;
  return seoMetadata(s, { title, description: `فهرست برندهای محصولات ${s.siteName}`, path: "/brands" });
}

export default async function BrandsIndexPage() {
  const rows = await getPublicBrandIndex();
  return <><SiteHeader/><main className="mx-auto max-w-7xl space-y-6 px-4 py-8"><div className="rounded-3xl bg-gradient-to-l from-emerald-950 to-emerald-700 p-6 text-white"><div className="flex items-center gap-3"><Tags className="size-8 text-lime-300"/><div><h1 className="text-2xl font-black">برندهای فروشگاه</h1><p className="mt-1 text-sm text-emerald-100">محصولات و راهنماهای هر برند را یکجا ببینید.</p></div></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map(({ brand, productCount })=><Link key={brand.id} href={`/brands/${brand.slug}`} className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"><div className="relative h-36 bg-gradient-to-l from-emerald-950 to-emerald-700">{brand.bannerMediaId&&<Img id={brand.bannerMediaId} alt="" className="size-full opacity-60"/>}<div className="absolute inset-0 flex items-center justify-center"><span className="grid size-20 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg">{brand.logoMediaId?<Img id={brand.logoMediaId} alt={brand.name} className="size-full"/>:<Tags className="size-8 text-emerald-700"/>}</span></div></div><div className="p-4"><h2 className="font-black text-emerald-950 group-hover:text-emerald-700">{brand.name}</h2>{brand.description&&<p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{brand.description.replace(/<[^>]*>/g," ")}</p>}<span className="mt-3 block text-xs text-slate-400">{Number(productCount).toLocaleString("fa-IR")} محصول</span></div></Link>)}</div>{!rows.length&&<p className="rounded-2xl border border-dashed p-10 text-center text-slate-500">هنوز برندی منتشر نشده است.</p>}</main><SiteFooter/></>;
}
