import { ShieldCheck, Store, Truck, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "درباره ما" };

export default function About() {
  const items = [[ShieldCheck, "تضمین اصالت", "هر محصول با برچسب اصالت (ارگانیک گواهی‌شده / طبیعی / محلی) و بررسی تخصصی کارشناسان عرضه می‌شود."], [Store, "مارکت‌پلیس چندفروشنده", "مقایسه قیمت، زمان آماده‌سازی و ضمانت چند تأمین‌کننده برای یک محصول."], [Truck, "ارسال مستقل و شفاف", "هر فروشنده مرسوله و کد رهگیری جداگانه دارد."], [Search, "تأمین محصولات کمیاب", "با کد محصول، VIN یا تصویر محصول، ما آن را برایتان پیدا می‌کنیم."]] as const;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <section className="rounded-3xl bg-gradient-to-l from-emerald-700 to-slate-900 p-8 text-white"><h1 className="text-3xl font-black">درباره سبزینه</h1><p className="mt-3 max-w-2xl leading-8 text-emerald-100">سبزینه پلتفرمی تخصصی برای خرید، استعلام و تأمین محصولات ارگانیک است که انبار مرکزی و ده‌ها تأمین‌کننده معتبر را در یک بستر امن، با پرداخت امانی و آزادسازی وجه پس از تحویل، گرد هم آورده است.</p></section>
        <div className="grid gap-4 sm:grid-cols-2">{items.map(([I, t, d]) => <div key={t} className="rounded-2xl border bg-white p-6"><I className="mb-3 h-8 w-8 text-emerald-600" /><b className="text-lg">{t}</b><p className="mt-2 text-sm leading-7 text-slate-600">{d}</p></div>)}</div>
      </main>
      <SiteFooter />
    </>
  );
}
