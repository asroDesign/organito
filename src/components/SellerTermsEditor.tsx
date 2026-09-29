"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Percent, CalendarClock, FileSignature, Power, Check } from "lucide-react";
import { api, toast } from "./client";

const STATUS: [string, string, string][] = [["pending", "در انتظار پذیرش", "bg-amber-500"], ["approved", "فعال", "bg-emerald-500"], ["suspended", "تعلیق", "bg-rose-500"], ["rejected", "رد", "bg-slate-500"]];
const CONTRACT: [string, string][] = [["pending", "در انتظار امضا"], ["signed", "امضاشده"], ["expired", "منقضی"]];
const PRESET_RATES = [5, 7, 8, 10, 12, 15];
const PRESET_DAYS: [number, string][] = [[0, "فوری"], [3, "۳ روز"], [7, "هفتگی"], [14, "دو هفته"], [30, "ماهانه"]];

/** Commission & settlement editor with clear controls, live example and dirty-state save. */
export function SellerTermsEditor({ id, status, contract, rate, days, compact }: { id: number; status: string; contract: string; rate: number; days: number; compact?: boolean }) {
  const router = useRouter();
  const init = { status, contractStatus: contract, commissionRate: rate, settlementDays: days };
  const [s, setS] = useState(init);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(init);
  const sample = 10_000_000;
  const fee = Math.round((sample * s.commissionRate) / 100);
  const save = async () => {
    setBusy(true);
    try { await api(`/api/admin/sellers/${id}/terms`, "POST", s); toast("شرایط همکاری ذخیره شد"); router.refresh(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  };
  return (
    <div className={`space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 ${compact ? "p-3" : "p-4"} text-sm`}>
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><Power className="h-3.5 w-3.5" />وضعیت فعالیت</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {STATUS.map(([k, l, c]) => <button key={k} type="button" onClick={() => setS({ ...s, status: k })} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${s.status === k ? "border-slate-800 bg-white font-bold shadow-sm" : "border-transparent bg-white/60 text-slate-500 hover:bg-white"}`}><span className={`h-2 w-2 rounded-full ${c}`} />{l}</button>)}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><FileSignature className="h-3.5 w-3.5" />وضعیت قرارداد</div>
        <div className="flex gap-1.5">{CONTRACT.map(([k, l]) => <button key={k} type="button" onClick={() => setS({ ...s, contractStatus: k })} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${s.contractStatus === k ? "border-emerald-500 bg-emerald-50 font-bold text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}>{l}</button>)}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Percent className="h-3.5 w-3.5" />نرخ کمیسیون</span>
            <div className="flex items-center rounded-lg border border-slate-200"><input type="number" min={0} max={50} value={s.commissionRate} onChange={(e) => setS({ ...s, commissionRate: Math.max(0, Math.min(50, Math.round(Number(e.target.value) || 0))) })} className="w-14 rounded-lg bg-transparent px-2 py-1 text-center text-sm font-black outline-none" dir="ltr" /><span className="pl-2 text-xs text-slate-400">٪</span></div>
          </div>
          <input type="range" min={0} max={30} value={Math.min(30, s.commissionRate)} onChange={(e) => setS({ ...s, commissionRate: Number(e.target.value) })} className="w-full accent-emerald-600" />
          <div className="mt-2 flex flex-wrap gap-1">{PRESET_RATES.map((r) => <button key={r} type="button" onClick={() => setS({ ...s, commissionRate: r })} className={`rounded-md px-2 py-0.5 text-[11px] ${s.commissionRate === r ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{r.toLocaleString("fa-IR")}٪</button>)}</div>
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">مثال: از فروش {sample.toLocaleString("fa-IR")} تومانی، <b className="text-rose-600">{fee.toLocaleString("fa-IR")}</b> کمیسیون و <b className="text-emerald-700">{(sample - fee).toLocaleString("fa-IR")}</b> تومان سهم فروشنده است.</div>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><CalendarClock className="h-3.5 w-3.5" />دوره تسویه</span>
            <div className="flex items-center rounded-lg border border-slate-200"><input type="number" min={0} max={90} value={s.settlementDays} onChange={(e) => setS({ ...s, settlementDays: Math.max(0, Math.min(90, Math.round(Number(e.target.value) || 0))) })} className="w-14 rounded-lg bg-transparent px-2 py-1 text-center text-sm font-black outline-none" dir="ltr" /><span className="pl-2 text-xs text-slate-400">روز</span></div>
          </div>
          <div className="grid grid-cols-5 gap-1">{PRESET_DAYS.map(([d, l]) => <button key={d} type="button" onClick={() => setS({ ...s, settlementDays: d })} className={`rounded-md px-1 py-1.5 text-[11px] ${s.settlementDays === d ? "bg-emerald-600 font-bold text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>)}</div>
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">وجه فروشنده پس از تأیید تحویل سفارش به «قابل برداشت» منتقل می‌شود؛ درخواست‌های برداشت {s.settlementDays === 0 ? "بلافاصله" : `در دوره‌های ${s.settlementDays.toLocaleString("fa-IR")} روزه`} پرداخت می‌گردند.</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">{dirty ? "تغییرات ذخیره نشده است" : "بدون تغییر"}</span>
        <div className="flex gap-2">{dirty && <button type="button" onClick={() => setS(init)} className="btn-sm">انصراف</button>}<button type="button" disabled={!dirty || busy} onClick={save} className="btn-primary !py-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}ذخیره شرایط</button></div>
      </div>
    </div>
  );
}
