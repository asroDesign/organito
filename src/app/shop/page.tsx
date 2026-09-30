import Link from "next/link";
import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { SlidersHorizontal, X, PackageSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { categoriesWithCounts, listShopProducts, vehicleMakes, type ShopFilters } from "@/lib/queries";
import { AUTH_LABEL, faNum } from "@/lib/util";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";
import { stripHtml, toSafeHtml } from "@/lib/html";

const PER = 12;
const SORTS: [string, string][] = [["relevance", "مرتبط‌ترین"], ["best", "پرفروش‌ترین"], ["new", "جدیدترین"], ["price_asc", "ارزان‌ترین"], ["price_desc", "گران‌ترین"], ["discount", "بیشترین تخفیف"]];

export async function generateMetadata({ searchParams }: { searchParams: Promise<ShopFilters> }): Promise<Metadata> {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  const [cat] = sp.cat ? await db.select().from(categories).where(eq(categories.id, Number(sp.cat))).limit(1) : [];
  const title = cat?.seoTitle || (cat ? `خرید ${cat.name} ارگانیک و طبیعی` : s.shopSeoTitle);
  const description = cat?.metaDescription || (cat ? stripHtml(cat.description, 160) || `خرید اینترنتی ${cat.name} با تضمین کیفیت و ارسال مطمئن از سبزینه.` : s.shopSeoDescription);
  return seoMetadata(s, { title, description, keywords: cat?.seoKeywords || s.shopSeoKeywords, path: cat ? `/shop?cat=${cat.id}` : "/shop", canonical: cat?.canonicalUrl });
}

export default async function Shop({ searchParams }: { searchParams: Promise<ShopFilters> }) {
  const sp = await searchParams;
  const [items, cats, brands, makes, st] = await Promise.all([
    listShopProducts(sp), categoriesWithCounts(),
    db.selectDistinct({ b: products.brand }).from(products).where(sql`${products.status} in ('active','out_of_stock')`), vehicleMakes(), getSettings(),
  ]);
  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(items.length / PER));
  const shown = items.slice((page - 1) * PER, page * PER);
  const cat = cats.find((c) => String(c.id) === sp.cat);
  const categoryFaqs = (cat?.faqs ?? []) as { question: string; answer: string }[];
  const base = siteBase(st.siteUrl);
  const href = (patch: Partial<ShopFilters>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/shop${q.toString() ? `?${q}` : ""}`;
  };
  const chips: [string, keyof ShopFilters][] = [];
  if (sp.q) chips.push([`«${sp.q}»`, "q"]);
  if (cat) chips.push([cat.name, "cat"]);
  if (sp.brand) chips.push([`برند: ${sp.brand}`, "brand"]);
  if (sp.auth) chips.push([AUTH_LABEL[sp.auth] ?? sp.auth, "auth"]);
  if (sp.make) chips.push([`محصول: ${sp.make}`, "make"]);
  if (sp.stock) chips.push([sp.stock === "in" ? "فقط موجود" : "ناموجود", "stock"]);
  if (sp.fest) chips.push(["محصولات جشنواره", "fest"]);
  if (sp.min || sp.max) chips.push([`قیمت ${sp.min ? `از ${faNum(Number(sp.min))}` : ""} ${sp.max ? `تا ${faNum(Number(sp.max))}` : ""}`, "min"]);
  const Filters = (
    <form className="space-y-5">
      {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      <div><b className="mb-2 block text-sm">جست‌وجو</b><input name="q" defaultValue={sp.q} placeholder="نام محصول، برند یا کد" className="input" /></div>
      <div><b className="mb-2 block text-sm">دسته‌بندی</b>
        <div className="max-h-52 space-y-1 overflow-y-auto text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="cat" value="" defaultChecked={!sp.cat} />همه</label>
          {cats.map((c) => <label key={c.id} className={`flex items-center justify-between gap-2 ${c.parent_id ? "pr-4" : ""}`}><span className="flex items-center gap-2"><input type="radio" name="cat" value={c.id} defaultChecked={sp.cat === String(c.id)} />{c.name}</span><span className="text-xs text-slate-400">{faNum(c.n)}</span></label>)}
        </div>
      </div>
      <div><b className="mb-2 block text-sm">بازه قیمت (تومان)</b><div className="grid grid-cols-2 gap-2"><input name="min" type="number" defaultValue={sp.min} placeholder="از" className="input" /><input name="max" type="number" defaultValue={sp.max} placeholder="تا" className="input" /></div></div>
      <div><b className="mb-2 block text-sm">نوع محصول</b><div className="space-y-1 text-sm">{[["", "همه"], ["Original", "ارگانیک گواهی‌شده"], ["OEM", "طبیعی و بدون افزودنی"], ["Aftermarket", "محلی و سنتی"]].map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" name="auth" value={v} defaultChecked={(sp.auth ?? "") === v} />{l}</label>)}</div></div>
      <div><b className="mb-2 block text-sm">برند</b><select name="brand" defaultValue={sp.brand ?? ""} className="input"><option value="">همه برندها</option>{brands.map((b) => <option key={b.b}>{b.b}</option>)}</select></div>
      <div><b className="mb-2 block text-sm">گواهی / استاندارد</b><select name="make" defaultValue={sp.make ?? ""} className="input"><option value="">همه محصولها</option>{makes.map((m) => <option key={m.make}>{m.make}</option>)}</select></div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5"><span>فقط کالاهای موجود</span><input type="checkbox" name="stock" value="in" defaultChecked={sp.stock === "in"} /></label>
        <label className="flex items-center justify-between rounded-xl bg-rose-50 p-2.5 text-rose-700"><span>فقط محصولات جشنواره</span><input type="checkbox" name="fest" value="1" defaultChecked={!!sp.fest} /></label>
      </div>
      <button className="btn-primary w-full">اعمال فیلترها</button>
    </form>
  );
  return (
    <>
      <SiteHeader />
      {cat && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@graph": [
        { "@type": "CollectionPage", name: cat.seo_title || cat.name, description: cat.meta_description || stripHtml(cat.description, 200), url: new URL(`/shop?cat=${cat.id}`, base).toString() },
        ...(categoryFaqs.length ? [{ "@type": "FAQPage", mainEntity: categoryFaqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }] : []),
      ] }) }} />}
      <div className="border-b bg-gradient-to-l from-emerald-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <nav className="mb-2 text-xs text-slate-500"><Link href="/">خانه</Link> / <Link href="/shop">فروشگاه</Link>{cat && <> / {cat.name}</>}</nav>
          <h1 className="text-2xl font-black text-slate-900">{cat?.name ?? (sp.q ? `نتایج جست‌وجو «${sp.q}»` : sp.fest ? "محصولات جشنواره" : "همه محصولات")}</h1>
          {cat?.description && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-500">{stripHtml(cat.description, 220)}</p>}
        </div>
      </div>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[270px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-36 rounded-2xl border border-slate-200 bg-white p-5">{Filters}</div></aside>
        <section className="min-w-0">
          <details className="mb-4 rounded-2xl border bg-white p-4 lg:hidden"><summary className="flex cursor-pointer items-center gap-2 font-bold"><SlidersHorizontal className="h-4 w-4" />فیلترها</summary><div className="mt-4">{Filters}</div></details>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
            <span className="px-2 text-xs text-slate-500">مرتب‌سازی:</span>
            {SORTS.map(([k, l]) => <Link key={k} href={href({ sort: k })} className={`rounded-xl px-3 py-1.5 text-sm ${(sp.sort ?? "relevance") === k ? "bg-emerald-600 font-bold text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</Link>)}
            <span className="mr-auto px-2 text-sm text-slate-500">{faNum(items.length)} کالا</span>
          </div>
          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chips.map(([l, k]) => <Link key={k} href={href(k === "min" ? { min: undefined, max: undefined } : { [k]: undefined })} className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-200">{l}<X className="h-3 w-3" /></Link>)}
              <Link href="/shop" className="rounded-full px-3 py-1 text-xs text-rose-600 hover:bg-rose-50">حذف همه</Link>
            </div>
          )}
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <PackageSearch className="h-16 w-16 text-slate-300" /><b className="text-lg">کالایی با این مشخصات پیدا نشد</b>
              <p className="max-w-md text-sm text-slate-500">فیلترها را تغییر دهید یا از سامانه استعلام، محصول را با کد محصول درخواست کنید تا کارشناسان ما آن را تأمین کنند.</p>
              <Link href={`/customer/supply?pn=${encodeURIComponent(sp.q ?? "")}`} className="btn-primary">ثبت درخواست تأمین</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 sm:gap-4">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          )}
          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-1">
              <Link aria-disabled={page <= 1} href={href({ page: String(Math.max(1, page - 1)) })} className="btn-sm"><ChevronRight className="h-4 w-4" /></Link>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Link key={n} href={href({ page: String(n) })} className={`grid h-9 min-w-9 place-items-center rounded-lg text-sm ${n === page ? "bg-emerald-600 font-bold text-white" : "border bg-white"}`}>{faNum(n)}</Link>)}
              <Link href={href({ page: String(Math.min(pages, page + 1)) })} className="btn-sm"><ChevronLeft className="h-4 w-4" /></Link>
            </nav>
          )}
          {cat?.description && <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black text-emerald-950">راهنمای خرید {cat.name}</h2><div className="prose prose-slate max-w-none leading-8" dangerouslySetInnerHTML={{ __html: toSafeHtml(cat.description) }} /></section>}
          {categoryFaqs.length > 0 && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black text-emerald-950">سؤالات متداول درباره {cat?.name}</h2><div className="divide-y divide-slate-100">{categoryFaqs.map((faq, i) => <details key={i} className="group py-4"><summary className="cursor-pointer list-none font-bold text-slate-800 marker:hidden">{faq.question}<span className="float-left text-emerald-600 transition group-open:rotate-45">＋</span></summary><p className="pt-3 text-sm leading-8 text-slate-600">{faq.answer}</p></details>)}</div></section>}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
