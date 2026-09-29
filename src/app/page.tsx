import Link from "next/link";
import { eq } from "drizzle-orm";
import { ShieldCheck, Truck, Leaf, Wallet, Flame, ArrowLeft, Sprout, Tractor, HeartPulse, FlaskConical, Star, Quote, BadgePercent, MapPin } from "lucide-react";
import { db } from "@/db";
import { sellers } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { VehicleFinder } from "@/components/VehicleFinder";
import { Countdown } from "@/components/Countdown";
import { categoriesWithCounts, listShopProducts, vehicleMakes } from "@/lib/queries";
import { activeFestivals } from "@/lib/marketing";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";
import { faNum } from "@/lib/util";

const CAT_STYLE = [
  ["🍯", "from-amber-100 to-amber-200"], ["🌿", "from-lime-100 to-emerald-200"], ["🌰", "from-orange-100 to-amber-200"],
  ["🫒", "from-lime-100 to-lime-200"], ["🥬", "from-emerald-100 to-green-200"], ["🥚", "from-yellow-50 to-orange-100"],
];

export default async function Home() {
  await ensureSeeded();
  const [all, cats, makes, fests, farms, st] = await Promise.all([
    listShopProducts({}), categoriesWithCounts(), vehicleMakes(), activeFestivals(),
    db.select().from(sellers).where(eq(sellers.status, "approved")).limit(6), getSettings(),
  ]);
  const mv = !!st.multiVendor;
  const deals = [...all].filter((p) => p.inStock && p.discountPct > 0).sort((a, b) => b.discountPct - a.discountPct).slice(0, 6);
  const endOfDay = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
  const fest = fests[0];
  const festItems = all.filter((p) => p.festival && p.inStock).slice(0, 4);
  const best = [...all].filter((p) => p.inStock).sort((a, b) => b.sold - a.sold).slice(0, 10);
  const fresh = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const roots = cats.filter((c) => !c.parent_id);
  return (
    <>
      <SiteHeader />
      {/* HERO */}
      <section className="relative overflow-hidden">
        {st.heroMediaId && st.heroType === "video"
          ? <video src={`/api/media/${st.heroMediaId}`} autoPlay muted loop playsInline preload="auto" poster="/images/home-harvest.jpg" className="absolute inset-0 h-full w-full object-cover" />
          : /* eslint-disable-next-line @next/next/no-img-element */ <img src={st.heroMediaId ? `/api/media/${st.heroMediaId}` : "/images/home-harvest.jpg"} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-l from-emerald-950/95 via-emerald-900/75 to-emerald-900/10" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[1.25fr_1fr] lg:py-24">
          <div className="space-y-6 text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-lime-300/20 px-4 py-1.5 text-xs font-bold text-lime-200 ring-1 ring-lime-300/30 backdrop-blur"><Leaf className="h-4 w-4" />مستقیم از مزرعه به سفره شما</span>
            <h1 className="text-balance bg-gradient-to-l from-white via-lime-100 to-yellow-100 bg-clip-text text-4xl font-black leading-[1.35] text-transparent md:text-6xl">{st.heroTitle}</h1>
            <p className="max-w-xl text-lg leading-9 text-emerald-50/90">{st.heroSubtitle}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop" className="rounded-2xl bg-lime-400 px-6 py-3 font-black text-emerald-950 shadow-xl shadow-lime-500/30 transition hover:bg-lime-300">شروع خرید</Link>
              <Link href="/shop?fest=1" className="rounded-2xl bg-white/10 px-6 py-3 font-bold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">پیشنهادهای ویژه</Link>
            </div>
            <div className="flex flex-wrap gap-8 pt-4">
              {[[`${faNum(all.length)}+`, "محصول ارگانیک"], mv ? [`${faNum(farms.length)}+`, "تولیدکننده منتخب"] : [`${faNum(st.returnDays)} روز`, "ضمانت بازگشت"], ["۱۰۰٪", "ضمانت اصالت"]].map(([v, l]) => <div key={l}><b className="block text-3xl font-black text-lime-300">{v}</b><span className="text-sm text-emerald-100/80">{l}</span></div>)}
            </div>
          </div>
          <VehicleFinder makes={makes} />
        </div>
        <svg viewBox="0 0 1440 60" className="relative block w-full text-[#faf7ef]" preserveAspectRatio="none"><path fill="currentColor" d="M0,40 C360,90 1080,-10 1440,40 L1440,60 L0,60 Z" /></svg>
      </section>

      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-16">
        {/* TRUST */}
        <section className="-mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[[ShieldCheck, "گواهی ارگانیک معتبر", "بازرسی و آزمون آزمایشگاهی"], [Truck, "ارسال تازه و سریع", "بسته‌بندی عایق و بهداشتی"], [Wallet, "پرداخت امن امانی", "آزادسازی وجه پس از تحویل"], [Tractor, "حمایت از کشاورز", "خرید مستقیم و منصفانه"]].map(([I, t, d]) => {
            const Icon = I as typeof Truck;
            return <div key={t as string} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-900/5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="h-6 w-6" /></span><div><b className="text-sm text-emerald-950">{t as string}</b><div className="text-[11px] text-slate-500">{d as string}</div></div></div>;
          })}
        </section>

        {/* CATEGORIES */}
        <section>
          <Title title="دسته‌بندی محصولات" sub="از کندو و باغ تا مزرعه" href="/categories" />
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {roots.map((c, i) => {
              const [emoji, bg] = CAT_STYLE[i % CAT_STYLE.length];
              return (
                <Link key={c.id} href={`/shop?cat=${c.id}`} className="group flex flex-col items-center gap-3 text-center">
                  <span className={`grid aspect-square w-full max-w-32 place-items-center rounded-full bg-gradient-to-br ${bg} text-5xl shadow-inner ring-4 ring-white transition duration-300 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-xl`}>{emoji}</span>
                  <span><b className="block text-sm text-emerald-950">{c.name}</b><span className="text-[11px] text-slate-500">{faNum(c.n)} محصول</span></span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FESTIVAL */}
        {fest && festItems.length > 0 && (
          <section className="relative overflow-hidden rounded-[2.5rem] p-6 text-white md:p-8" style={{ background: `linear-gradient(125deg, ${fest.color}, #7c2d12 55%, #14532d)` }}>
            <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-3xl bg-white/15 backdrop-blur"><Flame className="h-9 w-9" /></span><div><h2 className="text-2xl font-black md:text-3xl">{fest.title}</h2><p className="text-sm text-white/85">{fest.description} · تا {faNum(fest.discountPercent)}٪ تخفیف</p></div></div>
              <div className="flex items-center gap-3"><span className="text-sm text-white/80">پایان جشنواره:</span><Countdown to={fest.endsAt.toISOString()} light /></div>
            </div>
            <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4">{festItems.map((p) => <div key={p.id} className="text-slate-900"><ProductCard p={p} /></div>)}</div>
            <Link href="/shop?fest=1" className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-black text-emerald-900">همه محصولات جشنواره<ArrowLeft className="h-4 w-4" /></Link>
          </section>
        )}

        {/* DAILY DEALS (honeykando style) */}
        {deals.length > 0 && (
          <section className="overflow-hidden rounded-[2.5rem] bg-gradient-to-l from-amber-400 via-amber-300 to-yellow-200 p-5 md:p-7">
            <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <div className="flex flex-col items-center justify-center gap-3 text-center text-amber-950">
                <span className="text-5xl">🍯</span>
                <h2 className="text-2xl font-black leading-snug">شگفت‌انگیزهای<br />امروز</h2>
                <Countdown to={endOfDay} />
                <Link href="/shop?sort=discount" className="rounded-2xl bg-amber-950 px-5 py-2 text-sm font-bold text-amber-100">مشاهده همه</Link>
              </div>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">{deals.map((p) => <div key={p.id} className="w-52 shrink-0 snap-start"><ProductCard p={p} /></div>)}</div>
            </div>
          </section>
        )}

        {/* BEST */}
        <section>
          <Title title="محبوب‌ترین‌های سبزینه" sub="انتخاب مشتریان در هفته گذشته" href="/shop?sort=best" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{best.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>

        {/* WHY ORGANIC */}
        <section className="grid items-center gap-8 overflow-hidden rounded-[2.5rem] bg-emerald-950 p-8 text-white md:grid-cols-2 md:p-12">
          <div className="space-y-4">
            <span className="text-sm font-bold text-lime-300">چرا ارگانیک؟</span>
            <h2 className="text-balance text-3xl font-black leading-snug">سلامت شما، سلامت زمین</h2>
            <p className="leading-8 text-emerald-100/80">محصولات ارگانیک بدون سموم شیمیایی، کود مصنوعی و مواد نگهدارنده تولید می‌شوند. هر محصول در سبزینه پیش از عرضه از نظر اصالت، بقایای سموم و کیفیت بررسی می‌شود.</p>
            <Link href="/about" className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-2.5 text-sm font-black text-emerald-950">بیشتر بدانید<ArrowLeft className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[[HeartPulse, "ارزش غذایی بالاتر", "ویتامین و آنتی‌اکسیدان بیشتر"], [FlaskConical, "آزمون آزمایشگاهی", "بدون باقی‌مانده سموم"], [Sprout, "کشاورزی پایدار", "حفظ خاک و منابع آب"], [Leaf, "بدون افزودنی", "طعم و عطر طبیعی"]].map(([I, t, d]) => {
              const Icon = I as typeof Leaf;
              return <div key={t as string} className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10"><Icon className="mb-3 h-7 w-7 text-lime-300" /><b className="block">{t as string}</b><span className="text-xs text-emerald-100/70">{d as string}</span></div>;
            })}
          </div>
        </section>

        {/* GUARANTEE (honeykando style) */}
        <section className="grid items-center gap-6 rounded-[2.5rem] bg-white p-7 ring-1 ring-emerald-900/5 md:grid-cols-[auto_1fr_auto]">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-lime-200 to-emerald-300 text-5xl">🧪</span>
          <div><h2 className="text-xl font-black text-emerald-950">ضمانت بازگشت {faNum(st.returnDays)} روزه با تست آزمایشگاه</h2><p className="mt-2 text-sm leading-8 text-slate-600">اگر آزمایشگاه اصل نبودن محصول را تأیید کند، یا عطر و طعم آن به هر دلیلی مورد پسند شما نباشد، محصول را پس می‌گیریم و مبلغ را کامل برمی‌گردانیم.</p></div>
          <Link href="/faq" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">شرایط بازگشت</Link>
        </section>

        {/* FARMS */}
        {mv && farms.length > 0 && (
          <section>
            <Title title="تولیدکنندگان منتخب" sub="با کشاورزان و تولیدکنندگان ما آشنا شوید" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {farms.map((f) => (
                <div key={f.id} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-900/5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime-200 to-emerald-300 text-2xl font-black text-emerald-900">{f.shopName.slice(0, 1)}</span>
                  <div className="min-w-0"><b className="block truncate text-emerald-950">{f.shopName}</b><div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.city}</span><span className="flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3 fill-amber-400" />{faNum(f.rating)}</span></div></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NEW */}
        <section>
          <Title title="تازه رسیده‌ها" sub="محصولات فصل و جدیدترین‌ها" href="/shop?sort=new" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{fresh.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>

        {/* TESTIMONIALS */}
        <section>
          <Title title="مشتریان درباره ما" sub="تجربه واقعی خرید از سبزینه" />
          <div className="grid gap-4 md:grid-cols-3">
            {[["مریم احمدی", "عسل آویشن واقعاً طبیعی بود؛ بسته‌بندی عالی و ارسال سریع. دیگه از هیچ جای دیگه خرید نمی‌کنم."], ["علی رضایی", "سبد سبزیجات هفتگی تازه و خوش‌طعمه. خوبیش اینه که مستقیم از کشاورز میاد."], ["سارا کریمی", "روغن زیتون فرابکر با گواهی معتبر و قیمت منصفانه. پشتیبانی هم خیلی پاسخگو بود."]].map(([n, t]) => (
              <figure key={n} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-900/5"><Quote className="h-8 w-8 text-lime-400" /><blockquote className="mt-3 text-sm leading-8 text-slate-600">{t}</blockquote><figcaption className="mt-4 flex items-center justify-between"><b className="text-sm text-emerald-950">{n}</b><span className="flex text-amber-400">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />)}</span></figcaption></figure>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center gap-5 rounded-[2rem] bg-gradient-to-l from-lime-100 to-emerald-100 p-7">
            <BadgePercent className="h-14 w-14 shrink-0 text-emerald-700" />
            <div><b className="text-lg text-emerald-950">اولین خرید با <span dir="ltr" className="rounded-lg bg-white px-2 font-mono text-emerald-700">WELCOME10</span></b><p className="mt-1 text-sm text-emerald-900/70">۱۰٪ تخفیف برای خرید بالای ۵۰۰ هزار تومان</p><Link href="/shop" className="mt-3 inline-block text-sm font-bold text-emerald-700">شروع خرید ←</Link></div>
          </div>
          {mv ? <Link href="/login" className="group flex items-center gap-5 rounded-[2rem] bg-gradient-to-l from-amber-100 to-orange-100 p-7">
            <Tractor className="h-14 w-14 shrink-0 text-amber-700 transition group-hover:scale-110" />
            <div><b className="text-lg text-amber-950">کشاورز یا تولیدکننده هستید؟</b><p className="mt-1 text-sm text-amber-900/70">محصولاتتان را بدون واسطه به هزاران خانواده بفروشید.</p><span className="mt-3 inline-block text-sm font-bold text-amber-700">ثبت‌نام تولیدکنندگان ←</span></div>
          </Link> : <Link href="/customer/supply" className="group flex items-center gap-5 rounded-[2rem] bg-gradient-to-l from-amber-100 to-orange-100 p-7"><Sprout className="h-14 w-14 shrink-0 text-amber-700 transition group-hover:scale-110" /><div><b className="text-lg text-amber-950">محصول خاصی می‌خواهید؟</b><p className="mt-1 text-sm text-amber-900/70">سفارش ویژه ثبت کنید تا برایتان تهیه کنیم.</p><span className="mt-3 inline-block text-sm font-bold text-amber-700">ثبت سفارش ویژه ←</span></div></Link>}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Title({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-2xl font-black text-emerald-950"><Leaf className="h-6 w-6 text-lime-500" />{title}</h2>{sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}</div>
      {href && <Link href={href} className="flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-900/5 transition hover:gap-2">مشاهده همه<ArrowLeft className="h-4 w-4" /></Link>}
    </div>
  );
}
