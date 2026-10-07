"use client";
import { useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { faNum, toman } from "@/lib/util";
import { Modal } from "./Modal";

type PricePoint = { at: string; price: number; referencePrice: number; source: string };
type PriceSeries = { key: string; label: string; entries: PricePoint[] };
const sourceTitle: Record<string, string> = {
  baseline: "مبنای شروع ثبت تاریخچه",
  product_created: "ثبت محصول",
  product_created_variant: "ثبت تنوع",
  admin_product_edit: "ویرایش مدیر",
  seller_product_edit: "ویرایش فروشنده",
  admin_variant_edit: "ویرایش قیمت تنوع",
  variant_created: "ایجاد تنوع",
  seller_offer_created: "ثبت پیشنهاد فروشنده",
  seller_offer_edit: "ویرایش پیشنهاد فروشنده",
  quick_price_edit: "ویرایش سریع قیمت",
};

export function ProductPriceHistory({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [series, setSeries] = useState<PriceSeries[]>([]);
  const [selected, setSelected] = useState("");
  const [days, setDays] = useState(90);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");

  const load = async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${productId}/price-history`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "دریافت تاریخچه قیمت ممکن نشد");
      const rows = Array.isArray(data.series) ? data.series as PriceSeries[] : [];
      setSeries(rows);
      setSelected(rows[0]?.key ?? "");
      setLoadedAt(Date.now());
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت تاریخچه قیمت");
    } finally {
      setLoading(false);
    }
  };

  const active = series.find((x) => x.key === selected);
  const points = useMemo(() => (active?.entries ?? []).filter((x) => loadedAt > 0 && loadedAt - new Date(x.at).getTime() <= days * 86400000), [active, days, loadedAt]);
  const chart = useMemo(() => {
    if (!points.length) return null;
    const values = points.flatMap((p) => [p.price, ...(p.referencePrice > p.price ? [p.referencePrice] : [])]);
    const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, max * 0.05, 1);
    const xy = (value: number, index: number) => ({ x: points.length === 1 ? 360 : 30 + index * 660 / (points.length - 1), y: 205 - ((value - (min - span * 0.08)) / (span * 1.16)) * 180 });
    return {
      actual: points.map((p, i) => { const pxy = xy(p.price, i); return `${pxy.x},${pxy.y}`; }).join(" "),
      reference: points.flatMap((p, i) => p.referencePrice > p.price ? [`${xy(p.referencePrice, i).x},${xy(p.referencePrice, i).y}`] : []).join(" "),
      hasReference: points.some((p) => p.referencePrice > p.price),
      dots: points.map((p, i) => ({ ...xy(p.price, i), price: p.price, at: p.at })),
      min: min - span * 0.08,
      max: max + span * 0.08,
    };
  }, [points]);
  const change = points.length > 1 && points[0].price ? Math.round(((points.at(-1)!.price - points[0].price) / points[0].price) * 100) : null;

  return <>
    <button type="button" onClick={() => { setOpen(true); void load(); }} aria-label="مشاهده تاریخچه قیمت" title="تاریخچه قیمت" className="grid size-10 place-items-center rounded-full border border-emerald-100 bg-white/95 text-emerald-800 shadow-md backdrop-blur transition hover:scale-105 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
      <BarChart3 className="size-5"/><span className="sr-only">تاریخچه قیمت</span>
    </button>
    {open && <Modal title="تاریخچه قیمت محصول" onClose={() => setOpen(false)} wide>
      <p className="mb-4 text-xs leading-6 text-slate-500">تغییرات قیمت فروش و قیمت قبل از تخفیف بر اساس بازه انتخابی</p>
      {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="size-4 animate-spin"/>در حال دریافت تغییرات قیمت…</div>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!loading && loaded && series.length === 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">برای این محصول هنوز تاریخچه‌ای ثبت نشده است. تغییرات قیمت از زمان فعال شدن تاریخچه در این نمودار ذخیره می‌شوند.</p>}
      {!loading && loaded && series.length > 0 && <>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-52 flex-1 text-xs font-bold text-slate-600">ردیف قیمت
            <select className="input mt-1" value={selected} onChange={(e) => setSelected(e.target.value)}>{series.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
          <div className="flex rounded-xl bg-slate-100 p-1" aria-label="بازه نمودار">{([[30,"یک ماه"],[90,"سه ماه"],[365,"یک سال"]] as const).map(([n, label]) => <button key={n} type="button" onClick={() => setDays(n)} className={`rounded-lg px-3 py-2 text-xs ${days === n ? "bg-white font-bold text-emerald-800 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div>
        </div>
        {points.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">در این بازه تغییری ثبت نشده است.</p> : <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-emerald-600"/>قیمت فروش{chart?.hasReference && <><i className="mr-3 size-2.5 rounded-full bg-amber-400"/>قیمت قبل از تخفیف</>}</span>
            {change !== null && <span className={`rounded-full px-2.5 py-1 font-bold ${change > 0 ? "bg-rose-50 text-rose-700" : change < 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{change > 0 ? "+" : ""}{faNum(change)}٪ نسبت به ابتدا</span>}
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50/70 to-white p-2">
            <div className="mb-1 flex justify-between px-2 text-[10px] text-slate-400"><span>{toman(chart?.max ?? 0)}</span><span>{toman(chart?.min ?? 0)}</span></div>
            <svg role="img" aria-label="نمودار تغییرات قیمت" viewBox="0 0 720 220" className="h-48 w-full overflow-visible sm:h-60">
              {[40, 95, 150, 205].map((y) => <line key={y} x1="25" x2="695" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5"/>)}
              {chart?.hasReference && <polyline points={chart.reference} fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="7 6" strokeLinejoin="round" strokeLinecap="round"/>}
              <polyline points={chart?.actual ?? ""} fill="none" stroke="#059669" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
              {chart?.dots.map((point, i) => <circle key={`${point.at}-${i}`} cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#059669" strokeWidth="3"><title>{new Date(point.at).toLocaleDateString("fa-IR")} · {toman(point.price)}</title></circle>)}
            </svg>
            <div className="flex justify-between px-2 text-[10px] text-slate-400"><span>{new Date(points[0].at).toLocaleDateString("fa-IR")}</span><span>{new Date(points.at(-1)!.at).toLocaleDateString("fa-IR")}</span></div>
          </div>
          <div className="mt-4 max-h-44 space-y-2 overflow-y-auto">{[...points].reverse().slice(0, 12).map((point, i) => <div key={`${point.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs last:border-0"><span className="text-slate-500">{new Date(point.at).toLocaleDateString("fa-IR")} · {sourceTitle[point.source] ?? "تغییر قیمت"}</span><span className="font-bold text-emerald-900">{toman(point.price)}{point.referencePrice > point.price && <s className="mr-2 font-normal text-slate-400">{toman(point.referencePrice)}</s>}</span></div>)}</div>
          <p className="mt-3 text-[10px] leading-5 text-slate-400">تاریخچه از زمان شروع ثبت قیمت قابل مشاهده است؛ نقطهٔ مبنا نشان‌دهندهٔ قیمت موجود در زمان راه‌اندازی این قابلیت است.</p>
        </>}
      </>}
    </Modal>}
  </>;
}
