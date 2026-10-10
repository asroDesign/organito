import Link from "next/link";
import { Activity, ArrowLeft, BarChart3, Eye, ShieldCheck, ShoppingCart, TrendingUp } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { Card, FeatureIntro, PageHeader, Stat, Table, Td } from "@/components/ui";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { faNum, jdate } from "@/lib/util";

export const dynamic = "force-dynamic";
type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePage({ perm: "ORDERS_VIEW" });
  const report = await getAnalyticsReport(await searchParams);
  const steps = [
    { label: "بازدید صفحات", value: report.funnel.visits },
    { label: "مشاهده محصول", value: report.funnel.productViews },
    { label: "افزودن به سبد", value: report.funnel.addToCart },
    { label: "شروع checkout", value: report.funnel.checkouts },
    { label: "خرید پرداخت‌شده", value: report.funnel.purchases },
  ];
  const maxDaily = Math.max(1, ...report.daily.map((row) => row.visits));
  const funnelPct = (value: number) => report.funnel.visits ? Math.round(value * 100 / report.funnel.visits) : 0;
  return <div className="space-y-6">
    <PageHeader title="تحلیل مسیر خرید" subtitle="قیف ناشناس از بازدید تا سفارش پرداخت‌شده" actions={<Link href="/admin" className="btn-ghost">بازگشت به داشبورد</Link>} />
    <FeatureIntro tone="blue" icon={ShieldCheck} title="تحلیل بازدیدکنندگان فروشگاه" text="بازدیدها و رفتار خرید برای همه بازدیدکنندگان با شناسه تصادفی و کوتاه‌مدت نشست ثبت می‌شود. IP، نام، شماره تماس و آدرس دقیق صفحه ذخیره نمی‌شود؛ رویدادها پس از ۹۰ روز پاک می‌شوند." />
    <Card>
      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="text-xs text-slate-500">از تاریخ<div className="mt-1"><JalaliDatePicker name="from" defaultValue={report.from}/></div></label>
        <label className="text-xs text-slate-500">تا تاریخ<div className="mt-1"><JalaliDatePicker name="to" defaultValue={report.to}/></div></label>
        <button className="btn-primary"><BarChart3 className="size-4"/>اعمال بازه</button>
        <Link href="/admin/analytics" className="btn-ghost">۳۰ روز اخیر</Link>
      </form>
    </Card>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      <Stat label="بازدید صفحات" value={faNum(report.events.pageViews)} icon={Eye} tone="blue" hint="هر صفحه یک‌بار در هر نشست"/>
      <Stat label="نشست‌های بازدیدکننده" value={faNum(report.funnel.visits)} icon={ShieldCheck} tone="blue" hint="نشست یکتای کوتاه‌مدت"/>
      <Stat label="مشاهده محصول" value={faNum(report.events.productViews)} icon={BarChart3} tone="green" hint="هر محصول یک‌بار در هر نشست"/>
      <Stat label="افزودن به سبد" value={faNum(report.events.addToCart)} icon={ShoppingCart} tone="yellow" hint="تعداد رویدادها"/>
      <Stat label="شروع checkout" value={faNum(report.events.checkouts)} icon={Activity} tone="violet" hint="تعداد رویدادها"/>
      <Stat label="سفارش‌های پرداخت‌شده" value={faNum(report.events.paidOrders)} icon={TrendingUp} tone="green" hint="تعداد سفارش‌ها"/>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
    <Card title="قیف تبدیل"><div className="space-y-4">{steps.map((step, index) => <div key={step.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><b>{step.label}</b><span className="text-slate-500">{faNum(step.value)} نشست <span className="mr-1 text-xs">({funnelPct(step.value)}٪)</span></span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === steps.length - 1 ? "bg-amber-400" : "bg-emerald-600"}`} style={{ width: `${report.funnel.visits ? Math.max(step.value ? 1 : 0, step.value * 100 / report.funnel.visits) : 0}%` }}/></div></div>)}<p className="border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">نرخ‌ها بر پایه نشست‌های یکتا محاسبه می‌شوند؛ هر نشست در هر مرحله یک‌بار شمرده می‌شود. خرید پرداخت‌شده با شناسه همان نشست به سفارش مرتبط می‌شود.</p></div></Card>
      <Card title="منبع ورودی"><Table head={["منبع", "نشست بازدید", "نشست دارای افزودن به سبد", "نشست خریدار"]} empty={!report.sources.length}>{report.sources.map((row) => <tr key={row.source} className="hover:bg-slate-50"><Td><b>{row.source === "direct" ? "ورود مستقیم" : row.source}</b></Td><Td>{faNum(row.visits)}</Td><Td>{faNum(row.addToCart)}</Td><Td className="font-bold text-emerald-800">{faNum(row.purchases)}</Td></tr>)}</Table><p className="mt-2 text-xs text-slate-500">هر نشست حداکثر یک‌بار شمرده می‌شود؛ مجموع این ستون با تعداد نشست‌های قیف برابر است.</p></Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Card title="بازدید صفحه در روز — نشست‌های یکتا"><div className="space-y-3">{report.daily.map((row) => <div key={row.day} className="grid grid-cols-[6rem_1fr_4.5rem] items-center gap-3"><span className="text-xs text-slate-500">{jdate(new Date(`${row.day}T12:00:00Z`) )}</span><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${row.visits ? Math.max(1,row.visits*100/maxDaily) : 0}%`}}/></div><span className="text-left text-xs text-slate-500">{faNum(row.visits)} نشست</span></div>)}{!report.daily.length&&<p className="py-8 text-center text-sm text-slate-400">در این بازه هنوز بازدید ثبت‌شده‌ای وجود ندارد.</p>}</div></Card>
      <Card title="محصولات پرتوجه"><Table head={["محصول", "مشاهده (نشست یکتا)", "افزودن به سبد (رویداد)"]} empty={!report.products.length}>{report.products.map((product) => <tr key={product.id} className="hover:bg-slate-50"><Td><Link href={`/admin/products/${product.id}`} className="font-bold text-emerald-800 hover:underline">{product.name}<ArrowLeft className="mr-1 inline size-3"/></Link></Td><Td>{faNum(product.views)}</Td><Td>{faNum(product.carts)}</Td></tr>)}</Table></Card>
    </div>
    <p className="text-[11px] leading-6 text-slate-400">بازدید هر صفحه و مشاهده هر محصول در هر نشست فقط یک‌بار شمرده می‌شود. نمودار روزانه، قیف تبدیل و منبع ورودی بر اساس نشست‌های یکتا هستند. افزودن به سبد و شروع پرداخت تعداد رویدادها و سفارش‌های پرداخت‌شده تعداد سفارش‌ها را نمایش می‌دهند. در بازدیدهای قدیمی که شناسه صفحه ندارند، فقط نوع صفحه قابل تفکیک است. بازه گزارش: {jdate(new Date(`${report.from}T12:00:00Z`))} تا {jdate(new Date(`${report.to}T12:00:00Z`))}. سفارش پرداخت‌شده بر اساس زمان ثبت سفارش شمرده می‌شود. شناسه نشست کوتاه‌مدت است و برای همه بازدیدکنندگان ثبت می‌شود.</p>
  </div>;
}
