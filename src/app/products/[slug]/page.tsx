import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { MapPin, CalendarDays, Sprout, BadgeCheck, FlaskConical, Package, Thermometer, Hourglass, FileText, Microscope, ListChecks, MessageSquareText, MessageCircleQuestion, Store, Leaf, Star, Plus, Minus, CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { categories, productAnswers, productImages, productQuestions, products, productVariants, reviews, sellerOffers, sellers, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { activeFestivals, festivalFor } from "@/lib/marketing";
import { listShopProducts } from "@/lib/queries";
import { stripHtml, toSafeHtml } from "@/lib/html";
import { AUTH_LABEL, faNum, jdate, toman } from "@/lib/util";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BuyBox } from "@/components/BuyBox";
import { Gallery } from "@/components/Gallery";
import { ProductCard } from "@/components/ProductCard";
import { AnswerForm, QuestionForm, ReviewForm, ReviewImages, RoleBadge, Stars, VoteButtons } from "@/components/Community";

async function load(slug: string) {
  const [row] = await db.select({ p: products, cat: categories }).from(products).leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, decodeURIComponent(slug)), inArray(products.status, ["active", "out_of_stock"])));
  return row;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const row = await load((await params).slug);
  if (!row) return { title: "محصول یافت نشد" };
  return { title: row.p.seoTitle || row.p.nameFa, description: row.p.metaDesc || stripHtml(row.p.shortDesc) || undefined };
}

const ORG: [keyof import("@/db/schema").OrganicInfo, string, typeof MapPin][] = [
  ["origin", "خاستگاه", MapPin], ["harvest", "زمان برداشت / تولید", CalendarDays], ["method", "روش تولید", Sprout], ["certificate", "گواهی ارگانیک", BadgeCheck],
  ["labTest", "آزمون آزمایشگاهی", FlaskConical], ["ingredients", "ترکیبات", Package], ["storage", "شرایط نگهداری", Thermometer], ["shelfLife", "ماندگاری", Hourglass],
];

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const row = await load((await params).slug);
  if (!row) notFound();
  const p = row.p;
  const u = await getUser();
  const [imgs, variants, offers, fests, related, s, revs, qs] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, p.id)).orderBy(productImages.sortOrder),
    db.select().from(productVariants).where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true))),
    db.select({ o: sellerOffers, s: sellers }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
      .where(and(eq(sellerOffers.productId, p.id), eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false))),
    activeFestivals(),
    p.categoryId ? listShopProducts({ cat: String(p.categoryId) }, 12) : Promise.resolve([]),
    getSettings(),
    db.select({ r: reviews, name: users.name }).from(reviews).innerJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.productId, p.id), u ? or(eq(reviews.status, "approved"), eq(reviews.userId, u.id)) : eq(reviews.status, "approved"))).orderBy(desc(reviews.helpful), desc(reviews.createdAt)),
    db.select({ q: productQuestions, name: users.name }).from(productQuestions).innerJoin(users, eq(users.id, productQuestions.userId))
      .where(and(eq(productQuestions.productId, p.id), u ? or(eq(productQuestions.status, "approved"), eq(productQuestions.userId, u.id)) : eq(productQuestions.status, "approved"))).orderBy(desc(productQuestions.createdAt)),
  ]);
  const answers = qs.length ? await db.select({ a: productAnswers, name: users.name }).from(productAnswers).innerJoin(users, eq(users.id, productAnswers.userId))
    .where(and(inArray(productAnswers.questionId, qs.map((x) => x.q.id)), u ? or(eq(productAnswers.status, "approved"), eq(productAnswers.userId, u.id)) : eq(productAnswers.status, "approved"))).orderBy(productAnswers.createdAt) : [];
  const mv = !!s.multiVendor;
  const fest = festivalFor(fests, p.id, p.categoryId);
  const offerViews = offers.map(({ o, s: sl }) => ({ id: o.id, sellerId: sl.id, shopName: sl.shopName, rating: sl.rating, city: o.shipCity ?? sl.city, price: o.salePrice ?? o.price, listPrice: o.price, available: o.stock - o.reserved, shippingCost: o.shippingCost, prepDays: o.prepDays, warranty: o.warranty, isBuyBox: o.isBuyBox, condition: o.condition }))
    .sort((a, b) => Number(b.isBuyBox) - Number(a.isBuyBox) || a.price - b.price)
    .map((o, i) => (mv ? o : { ...o, sellerId: 0, shopName: s.siteName, city: "", rating: 0, id: o.id, isBuyBox: i === 0 }));
  const approved = revs.filter((x) => x.r.status === "approved");
  const avg = approved.length ? approved.reduce((a, x) => a + x.r.rating, 0) / approved.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: approved.filter((x) => x.r.rating === n).length }));
  const recPct = approved.filter((x) => x.r.recommend !== null).length ? Math.round((approved.filter((x) => x.r.recommend).length / approved.filter((x) => x.r.recommend !== null).length) * 100) : null;
  const allPros = approved.flatMap((x) => x.r.pros), allCons = approved.flatMap((x) => x.r.cons);
  const topOf = (arr: string[]) => Object.entries(arr.reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const org = p.organicInfo ?? {};
  const orgRows = ORG.filter(([k]) => org[k]);
  const rel = related.filter((r) => r.id !== p.id).slice(0, 5);
  const nav: [string, string, typeof FileText][] = [["desc", "معرفی محصول", FileText], ["review", "بررسی تخصصی", Microscope], ["specs", "مشخصات و شناسنامه", ListChecks], ["reviews", `دیدگاه‌ها (${faNum(approved.length)})`, MessageSquareText], ["qa", `پرسش و پاسخ (${faNum(qs.filter((x) => x.q.status === "approved").length)})`, MessageCircleQuestion], ...(mv && offerViews.length ? [["sellers", "فروشندگان", Store] as [string, string, typeof FileText]] : [])];
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: p.nameFa, sku: p.sku, brand: { "@type": "Brand", name: p.brand }, description: stripHtml(p.shortDesc), ...(approved.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: approved.length } } : {}) };
  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-6 pb-28 lg:pb-10">
        <nav className="text-xs text-slate-500"><Link href="/">خانه</Link> / <Link href="/shop">فروشگاه</Link>{row.cat && <> / <Link href={`/shop?cat=${row.cat.id}`}>{row.cat.name}</Link></>} / <span className="text-emerald-800">{p.nameFa}</span></nav>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr_380px]">
          <div className="lg:sticky lg:top-40 lg:self-start"><Gallery ids={imgs.map((i) => i.mediaId)} alt={p.nameFa} videoId={p.videoMediaId} badge={AUTH_LABEL[p.authenticity]} /></div>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`} className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-800 ring-1 ring-emerald-200">🌿 {p.brand}</Link>
              {row.cat && <Link href={`/shop?cat=${row.cat.id}`} className="rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-800 ring-1 ring-amber-200">{row.cat.name}</Link>}
              {org.origin && <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-slate-200"><MapPin className="h-3 w-3" />{org.origin}</span>}
            </div>
            <h1 className="text-balance text-2xl font-black leading-[1.7] text-emerald-950 md:text-3xl">{p.nameFa}</h1>
            {p.nameEn && <div className="-mt-4 text-sm text-slate-400" dir="ltr">{p.nameEn}</div>}
            <a href="#reviews" className="flex flex-wrap items-center gap-3 text-sm">
              <Stars value={avg} /><b className="text-amber-600">{approved.length ? faNum(Number(avg.toFixed(1))) : "—"}</b>
              <span className="text-slate-500">{approved.length ? `از ${faNum(approved.length)} دیدگاه` : "هنوز دیدگاهی ثبت نشده"}</span>
              {recPct !== null && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{faNum(recPct)}٪ پیشنهاد خرید</span>}
            </a>
            {p.shortDesc && <p className="leading-8 text-slate-600">{stripHtml(p.shortDesc, 500)}</p>}
            {(org.suitableFor?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1.5">{org.suitableFor!.map((t) => <Link key={t} href={`/shop?make=${encodeURIComponent(t)}`} className="flex items-center gap-1 rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-lime-800"><Leaf className="h-3 w-3" />{t}</Link>)}</div>}
            {orgRows.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {orgRows.slice(0, 4).map(([k, l, I]) => <div key={k} className="flex items-start gap-2.5 rounded-2xl bg-white p-3 ring-1 ring-emerald-900/5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><I className="h-4 w-4" /></span><div className="min-w-0"><div className="text-[11px] text-slate-500">{l}</div><b className="line-clamp-2 text-xs text-emerald-950">{org[k] as string}</b></div></div>)}
              </div>
            )}
            {p.specs.length > 0 && <ul className="grid gap-1.5 text-sm sm:grid-cols-2">{p.specs.slice(0, 6).map((sp) => <li key={sp.k} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-lime-500" /><span className="text-slate-500">{sp.k}:</span><b className="text-slate-700">{sp.v}</b></li>)}</ul>}
          </div>
          <div className="lg:sticky lg:top-40 lg:self-start">
            <BuyBox product={{ id: p.id, nameFa: p.nameFa, basePrice: p.basePrice, source: p.source, available: p.onHand - p.reserved, active: p.status === "active", partNumber: p.partNumber }}
              options={p.options} variants={variants.map((v) => ({ id: v.id, title: v.title, attrs: v.attrs, price: v.price, available: v.onHand - v.reserved }))} offers={offerViews}
              festival={fest ? { title: fest.title, pct: fest.discountPercent, color: fest.color, endsAt: fest.endsAt.toISOString() } : null}
              multiVendor={mv} siteName={s.siteName} freeShippingOver={s.freeShippingOver} returnDays={s.returnDays} compareAt={p.compareAtPrice} />
          </div>
        </div>

        <div className="sticky top-[118px] z-30 -mx-4 overflow-x-auto border-y border-emerald-900/10 bg-[#faf7ef]/95 px-4 backdrop-blur">
          <div className="flex gap-1">{nav.map(([id, l, I]) => <a key={id} href={`#${id}`} className="flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-4 py-3.5 text-sm font-medium text-slate-600 hover:border-emerald-600 hover:text-emerald-800"><I className="h-4 w-4" />{l}</a>)}</div>
        </div>

        <div className="space-y-8">
          <section id="desc" className="scroll-mt-44 rounded-[2rem] bg-white p-6 ring-1 ring-emerald-900/5 md:p-8"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-emerald-950"><FileText className="h-5 w-5 text-lime-500" />معرفی محصول</h2><div className="prose-rich" dangerouslySetInnerHTML={{ __html: toSafeHtml(p.description || p.shortDesc) }} /></section>
          {p.technicalReview && <section id="review" className="scroll-mt-44 rounded-[2rem] bg-gradient-to-l from-lime-50 to-white p-6 ring-1 ring-lime-200 md:p-8"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-emerald-950"><Microscope className="h-5 w-5 text-lime-600" />بررسی تخصصی و ارزش غذایی</h2><div className="prose-rich" dangerouslySetInnerHTML={{ __html: toSafeHtml(p.technicalReview) }} /></section>}
          <section id="specs" className="scroll-mt-44 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] bg-white p-6 ring-1 ring-emerald-900/5">
              <h2 className="mb-4 text-xl font-black text-emerald-950">مشخصات محصول</h2>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-100">
                {[...p.specs.map((sp) => [sp.k, sp.v]), ["برند", p.brand], ["نوع محصول", AUTH_LABEL[p.authenticity]], ["کشور / استان", p.country ?? "—"], ["وزن", p.weight ? `${faNum(p.weight)} گرم` : "—"], ["کد محصول", p.sku]].map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[40%_1fr] text-sm"><div className="bg-[#faf7ef] px-4 py-3 text-slate-500">{k}</div><div className="px-4 py-3 font-medium text-slate-800">{v}</div></div>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] bg-emerald-950 p-6 text-white">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Sprout className="h-5 w-5 text-lime-300" />شناسنامه محصول ارگانیک</h2>
              {orgRows.length === 0 ? <p className="text-sm text-emerald-100/70">اطلاعات شناسنامه برای این محصول ثبت نشده است.</p> : (
                <div className="grid gap-3 sm:grid-cols-2">{orgRows.map(([k, l, I]) => <div key={k} className="rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10"><div className="mb-1 flex items-center gap-1.5 text-xs text-lime-300"><I className="h-4 w-4" />{l}</div><b className="text-sm leading-7">{org[k] as string}</b></div>)}</div>
              )}
              {(org.suitableFor?.length ?? 0) > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{org.suitableFor!.map((t) => <span key={t} className="rounded-full bg-lime-400/20 px-3 py-1 text-xs text-lime-200">✓ مناسب {t}</span>)}</div>}
            </div>
          </section>

          <section id="reviews" className="scroll-mt-44 rounded-[2rem] bg-white p-6 ring-1 ring-emerald-900/5 md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-black text-emerald-950"><MessageSquareText className="h-5 w-5 text-lime-500" />دیدگاه خریداران</h2><ReviewForm productId={p.id} loggedIn={!!u} productName={p.nameFa} /></div>
            <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
              <aside className="space-y-4">
                <div className="rounded-3xl bg-[#faf7ef] p-5 text-center"><div className="text-5xl font-black text-emerald-950">{approved.length ? faNum(Number(avg.toFixed(1))) : "—"}</div><div className="my-2"><Stars value={avg} size={20} /></div><div className="text-xs text-slate-500">بر اساس {faNum(approved.length)} دیدگاه</div>
                  <div className="mt-4 space-y-1.5">{dist.map((d) => <div key={d.n} className="flex items-center gap-2 text-xs"><span className="w-3">{faNum(d.n)}</span><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-amber-400" style={{ width: `${approved.length ? (d.c / approved.length) * 100 : 0}%` }} /></div><span className="w-6 text-slate-400">{faNum(d.c)}</span></div>)}</div>
                  {recPct !== null && <div className="mt-4 rounded-2xl bg-white p-2 text-xs"><b className="text-emerald-700">{faNum(recPct)}٪</b> از خریداران این محصول را پیشنهاد کرده‌اند</div>}
                </div>
                {(allPros.length > 0 || allCons.length > 0) && (
                  <div className="space-y-3 rounded-3xl bg-white p-4 ring-1 ring-slate-100 text-xs">
                    {topOf(allPros).length > 0 && <div><b className="mb-1 block text-emerald-700">پرتکرارترین نقاط قوت</b>{topOf(allPros).map(([t, c]) => <div key={t} className="flex justify-between py-0.5"><span>+ {t}</span><span className="text-slate-400">{faNum(c)}</span></div>)}</div>}
                    {topOf(allCons).length > 0 && <div><b className="mb-1 block text-rose-600">پرتکرارترین نقاط ضعف</b>{topOf(allCons).map(([t, c]) => <div key={t} className="flex justify-between py-0.5"><span>− {t}</span><span className="text-slate-400">{faNum(c)}</span></div>)}</div>}
                  </div>
                )}
              </aside>
              <div className="space-y-4">
                {revs.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500"><Star className="mx-auto mb-2 h-10 w-10 text-slate-200" />اولین نفری باشید که درباره این محصول دیدگاه می‌نویسد.</div>}
                {revs.map(({ r, name }) => (
                  <article key={r.id} className={`rounded-3xl p-5 ring-1 ${r.status !== "approved" ? "bg-amber-50/50 ring-amber-200" : "ring-slate-100"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-lime-200 to-emerald-300 font-black text-emerald-900">{name.slice(0, 1)}</span><div><b className="text-sm">{name}</b><div className="flex items-center gap-2 text-[11px] text-slate-400">{jdate(r.createdAt)}{r.verifiedPurchase && <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 text-emerald-700"><CheckCircle2 className="h-3 w-3" />خریدار</span>}</div></div></div>
                      <div className="flex items-center gap-2"><Stars value={r.rating} size={14} />{r.status !== "approved" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{r.status === "pending" ? "در انتظار تأیید" : "تأیید نشد"}</span>}</div>
                    </div>
                    {r.title && <b className="mt-3 block text-emerald-950">{r.title}</b>}
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{r.body}</p>
                    {(r.pros.length > 0 || r.cons.length > 0) && <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">{r.pros.length > 0 && <ul className="space-y-1">{r.pros.map((t, i) => <li key={i} className="flex items-center gap-1.5 text-emerald-700"><Plus className="h-3.5 w-3.5" />{t}</li>)}</ul>}{r.cons.length > 0 && <ul className="space-y-1">{r.cons.map((t, i) => <li key={i} className="flex items-center gap-1.5 text-rose-600"><Minus className="h-3.5 w-3.5" />{t}</li>)}</ul>}</div>}
                    {r.mediaIds.length > 0 && <div className="mt-3"><ReviewImages ids={r.mediaIds} /></div>}
                    {r.recommend !== null && <div className={`mt-3 text-xs font-bold ${r.recommend ? "text-emerald-700" : "text-rose-600"}`}>{r.recommend ? "👍 خرید این محصول را پیشنهاد می‌کنم" : "👎 خرید این محصول را پیشنهاد نمی‌کنم"}</div>}
                    {r.adminReply && <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs leading-6"><b className="text-emerald-800">پاسخ {s.siteName}: </b>{r.adminReply}</div>}
                    {r.status === "approved" && <div className="mt-3 border-t border-slate-100 pt-3"><VoteButtons id={r.id} helpful={r.helpful} notHelpful={r.notHelpful} loggedIn={!!u} /></div>}
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="qa" className="scroll-mt-44 rounded-[2rem] bg-white p-6 ring-1 ring-emerald-900/5 md:p-8">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-black text-emerald-950"><MessageCircleQuestion className="h-5 w-5 text-lime-500" />پرسش و پاسخ</h2>
            <QuestionForm productId={p.id} loggedIn={!!u} />
            <div className="mt-6 space-y-4">
              {qs.length === 0 && <p className="text-center text-sm text-slate-500">هنوز پرسشی ثبت نشده است.</p>}
              {qs.map(({ q, name }) => {
                const as = answers.filter((x) => x.a.questionId === q.id);
                return (
                  <div key={q.id} className="rounded-3xl bg-[#faf7ef] p-5">
                    <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white">؟</span><div className="flex-1"><p className="font-bold leading-7 text-emerald-950">{q.body}</p><div className="text-[11px] text-slate-400">{name} · {jdate(q.createdAt)}{q.status !== "approved" && " · در انتظار تأیید"}</div></div></div>
                    <div className="mt-3 space-y-2 pr-11">
                      {as.map(({ a, name: an }) => <div key={a.id} className="rounded-2xl bg-white p-3 text-sm"><div className="mb-1 flex items-center gap-2 text-[11px]"><RoleBadge role={a.role} /><b>{an}</b><span className="text-slate-400">{jdate(a.createdAt)}</span>{a.status !== "approved" && <span className="text-amber-600">در انتظار تأیید</span>}</div><p className="leading-7 text-slate-700">{a.body}</p></div>)}
                      {q.status === "approved" && <AnswerForm questionId={q.id} loggedIn={!!u} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {mv && offerViews.length > 0 && (
            <section id="sellers" className="scroll-mt-44 rounded-[2rem] bg-white p-6 ring-1 ring-emerald-900/5">
              <h2 className="mb-4 text-xl font-black text-emerald-950">مقایسه فروشندگان</h2>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-slate-500"><tr><th className="p-2 text-right">فروشنده</th><th className="p-2 text-right">شهر</th><th className="p-2 text-right">آماده‌سازی</th><th className="p-2 text-right">ارسال</th><th className="p-2 text-right">ضمانت</th><th className="p-2 text-right">قیمت</th></tr></thead>
                <tbody className="divide-y">
                  {p.source === "central" && <tr><td className="p-2 font-bold">{s.siteName}</td><td className="p-2">انبار مرکزی</td><td className="p-2">۱ روز</td><td className="p-2">بر اساس شرکت پستی</td><td className="p-2">اصالت و تازگی</td><td className="p-2 font-bold">{toman(p.basePrice)}</td></tr>}
                  {offerViews.map((o) => <tr key={o.id}><td className="p-2 font-bold">{o.shopName} <span className="text-xs font-normal text-amber-500">★ {faNum(o.rating)}</span></td><td className="p-2">{o.city}</td><td className="p-2">{faNum(o.prepDays)} روز</td><td className="p-2">{toman(o.shippingCost)}</td><td className="p-2 text-xs">{o.warranty ?? "—"}</td><td className="p-2 font-bold">{toman(o.price)}</td></tr>)}
                </tbody>
              </table></div>
            </section>
          )}
        </div>

        {rel.length > 0 && (
          <section><h2 className="mb-5 flex items-center gap-2 text-2xl font-black text-emerald-950"><Leaf className="h-6 w-6 text-lime-500" />محصولات مرتبط</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{rel.map((r) => <ProductCard key={r.id} p={r} />)}</div></section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
