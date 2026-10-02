import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSettings } from "@/lib/settings";
import { siteBrandText } from "@/lib/brand";

export const metadata = { title: "سؤالات متداول" };
const FAQ: [string, string][] = [
  ["از کجا بدانم محصول واقعاً ارگانیک است؟", "محصولات با برچسب «ارگانیک گواهی‌شده» دارای گواهی معتبر از مراجع داخلی یا بین‌المللی هستند که مشخصات آن در بخش «گواهی‌ها و استانداردها» هر محصول آمده است."],
  ["تفاوت ارگانیک، طبیعی و محلی چیست؟", "ارگانیک گواهی‌شده بدون سم و کود شیمیایی و با بازرسی رسمی تولید می‌شود؛ طبیعی یعنی بدون افزودنی و نگهدارنده؛ محلی و سنتی محصول مستقیم کشاورزان و تولیدکنندگان کوچک است."],
  ["محصولات تازه چطور ارسال می‌شوند؟", "میوه، سبزی و لبنیات با بسته‌بندی عایق و در کوتاه‌ترین زمان ارسال می‌شوند. هر تولیدکننده محصول خود را مستقیماً و با کد رهگیری جداگانه ارسال می‌کند."],
  ["محصول مورد نظرم را پیدا نکردم، چه کنم؟", "از بخش «سفارش ویژه» درخواست ثبت کنید؛ کارشناسان ما از میان تولیدکنندگان بهترین گزینه را برای شما تأمین و پیش‌فاکتور صادر می‌کنند."],
  ["وجه پرداختی من چه زمانی به تولیدکننده می‌رسد؟", "وجه تا زمان تأیید دریافت سفارش توسط فروشگاه نزد مجموعه امانت است و سپس به تولیدکننده پرداخت می‌شود."],
  ["فاکتور رسمی دریافت می‌کنم؟", "بله؛ برای کالاهای انبار مرکزی فاکتور فروش و برای کالاهای تولیدکنندگان فاکتور نیابتی صادر و از صفحه سفارش قابل چاپ است."],
];

export default async function Faq() {
  const settings = await getSettings();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-black">سؤالات متداول</h1>
        {FAQ.map(([q, a]) => <details key={q} className="group rounded-2xl border bg-white p-5 open:shadow-sm"><summary className="cursor-pointer list-none font-bold marker:hidden">{q}<span className="float-left text-emerald-600 group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-8 text-slate-600">{siteBrandText(a, settings.siteName)}</p></details>)}
        <p className="text-sm text-slate-500">پاسخ خود را پیدا نکردید؟ <Link className="text-emerald-700" href="/customer/tickets">تیکت ثبت کنید</Link>.</p>
      </main>
      <SiteFooter />
    </>
  );
}
