"use client";

import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, PieChart, ShoppingBag } from "lucide-react";
import Link from "next/link";

export type DashboardPoint = { label: string; value: number };
export type PieSlice = { label: string; value: number; detail: string; href: string };
type Metric = "revenue" | "profit" | "orders";
const COLORS = ["#059669", "#84cc16", "#f59e0b", "#0ea5e9", "#8b5cf6", "#f43f5e"];
const fa = (n: number) => n.toLocaleString("fa-IR");
const shortDate = (s: string) => {
  const date = new Date(`${s}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).format(date) : s;
};

export function DashboardCharts({ points, pie, metric }: { points: DashboardPoint[]; pie: PieSlice[]; metric: Metric }) {
  const total = points.reduce((a, p) => a + p.value, 0);
  const average = points.length ? Math.round(total / points.length) : 0;
  const highest = points.reduce<DashboardPoint | null>((a, p) => !a || p.value > a.value ? p : a, null);
  const first = points[0]?.value ?? 0;
  const last = points.at(-1)?.value ?? 0;
  const trend = first ? Math.round(((last - first) / first) * 100) : 0;
  const width = 760, height = 260, padX = 38, padY = 24;
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const span = Math.max(1, max - min);
  const coords = points.map((p, i) => ({ ...p, x: padX + (points.length < 2 ? 0 : i * (width - padX * 2) / (points.length - 1)), y: padY + (height - padY * 2) * (1 - (p.value - min) / span) }));
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = coords.length ? `M${coords[0].x},${height-padY} L${coords.map((p) => `${p.x},${p.y}`).join(" L")} L${coords.at(-1)!.x},${height-padY} Z` : "";
  const caption = metric === "profit" ? "سود ثبت‌شده انبار مرکزی" : metric === "orders" ? "تعداد سفارش و فاکتور فروش" : "درآمد کل فروش‌های پرداخت‌شده";
  const top = pie.reduce((a, p) => a + p.value, 0);
  const segments = pie.reduce<Array<PieSlice & { percent: number; color: string; offset: number }>>((acc, p, i) => {
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].percent : 0;
    const percent = top ? p.value / top * 100 : 0;
    acc.push({ ...p, percent, color: COLORS[i % COLORS.length], offset });
    return acc;
  }, []);

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
    <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ChartNoAxesCombined className="size-4 text-emerald-600"/>{caption}</div><p className="mt-1 text-xs text-slate-400">روند تجمیعی در بازه انتخاب‌شده</p></div><div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${trend>=0?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{trend>=0?<ArrowUpRight className="size-3.5"/>:<ArrowDownRight className="size-3.5"/>}{fa(Math.abs(trend))}٪ تغییر نقطه شروع تا پایان</div></div>
      <div className="mt-4 grid grid-cols-3 gap-2"><MiniStat label="مجموع بازه" value={metric==="orders"?`${fa(total)} سفارش`:`${fa(total)} تومان`}/><MiniStat label="میانگین هر بازه" value={metric==="orders"?`${fa(average)} سفارش`:`${fa(average)} تومان`}/><MiniStat label="بیشترین مقدار" value={highest?(metric==="orders"?fa(highest.value):`${fa(highest.value)} تومان`):"—"}/></div>
      <div className="mt-4 overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] min-w-[640px] w-full" role="img" aria-label={caption}>
        <defs><linearGradient id="dashboard-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".24"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
        {[0,1,2,3].map((i)=><g key={i}><line x1={padX} x2={width-padX} y1={padY+i*(height-padY*2)/3} y2={padY+i*(height-padY*2)/3} stroke="#e2e8f0" strokeDasharray="4 5"/><text x={padX-8} y={padY+i*(height-padY*2)/3+4} textAnchor="end" fontSize="10" fill="#94a3b8">{fa(Math.round(max-i*max/3))}</text></g>)}
        {area&&<path d={area} fill="url(#dashboard-area)"/>}{coords.length>1&&<polyline points={line} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
        {coords.map((p)=><g key={p.label}><circle cx={p.x} cy={p.y} r="4" fill="#059669" stroke="white" strokeWidth="2"><title>{`${p.label}: ${fa(p.value)}${metric==="orders"?" سفارش":" تومان"}`}</title></circle></g>)}
        {coords.filter((_,i)=>i===0||i===coords.length-1||i===Math.floor(coords.length/2)||i===Math.floor(coords.length/4)||i===Math.floor(coords.length*3/4)).map((p)=><text key={`x-${p.label}`} x={p.x} y={height-4} textAnchor="middle" fontSize="10" fill="#64748b">{shortDate(p.label)}</text>)}
        {!points.length&&<text x={width/2} y={height/2} textAnchor="middle" fontSize="14" fill="#94a3b8">در این بازه داده‌ای ثبت نشده است</text>}
      </svg></div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span className="size-2 rounded-full bg-emerald-600"/>{caption}<span className="mr-auto">برای جزئیات هر نقطه نشانگر را لمس کنید</span></div>
    </section>

    <section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><PieChart className="size-4 text-amber-500"/>پرفروش‌ترین محصولات</div><p className="mt-1 text-xs text-slate-400">سهم بر اساس تعداد واحد فروخته‌شده</p>
      {segments.length ? <><div className="my-5 flex items-center justify-center"><div className="relative size-44 rounded-full" style={{background:`conic-gradient(${segments.map((s)=>`${s.color} ${s.offset}% ${s.offset+s.percent}%`).join(",")})`}}><div className="absolute inset-[22%] grid place-content-center rounded-full bg-white text-center shadow-inner"><ShoppingBag className="mx-auto size-5 text-emerald-700"/><b className="mt-1 text-lg text-slate-800">{fa(top)}</b><small className="text-[10px] text-slate-400">واحد فروش</small></div></div></div><div className="space-y-2">{segments.map((s)=><Link key={s.href} href={s.href} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50"><span className="size-2.5 shrink-0 rounded-full" style={{background:s.color}}/><span className="min-w-0 flex-1 truncate text-xs text-slate-600">{s.label}</span><span className="text-[10px] text-slate-400">{s.detail}</span><b className="w-9 text-left text-xs">{fa(Math.round(s.percent))}٪</b></Link>)}</div></>:<div className="grid min-h-56 place-items-center text-sm text-slate-400">در بازه انتخاب‌شده فروشی ثبت نشده است.</div>}
    </section>
  </div>;
}

function MiniStat({label,value}:{label:string;value:string}) { return <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] text-slate-400">{label}</div><b className="mt-1 block truncate text-xs text-slate-700" title={value}>{value}</b></div>; }
