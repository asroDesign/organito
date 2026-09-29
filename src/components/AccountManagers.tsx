"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { api, toast } from "./client";

const TYPES: Record<string, string> = { asset: "دارایی", liability: "بدهی", equity: "حقوق صاحبان سهام", revenue: "درآمد", expense: "هزینه" };
const LEVELS: Record<string, string> = { group: "گروه", general: "کل", subsidiary: "معین" };

type A = { id: number; code: string; name: string; type: string; level: string; parentId: number | null; balance: number };
export function AccountManager({ rows }: { rows: A[] }) {
  const router = useRouter();
  const [f, setF] = useState({ level: "subsidiary", parentId: "", code: "", name: "", type: "asset" });
  const [busy, setBusy] = useState(false);
  const parents = rows.filter((r) => (f.level === "general" ? r.level === "group" : f.level === "subsidiary" ? r.level !== "subsidiary" : false));
  const depth = (r: A): number => (r.parentId ? 1 + depth(rows.find((x) => x.id === r.parentId) ?? { ...r, parentId: null }) : 0);
  const act = async (url: string, data: Record<string, unknown>, ok: string) => {
    try { await api(url, "POST", data); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, false); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="p-2 text-right">کد</th><th className="p-2 text-right">نام حساب</th><th className="p-2 text-right">سطح</th><th className="p-2 text-right">ماهیت</th><th className="p-2 text-right">مانده</th><th /></tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={r.level === "group" ? "bg-slate-50 font-bold" : r.level === "general" ? "font-medium" : ""}>
                <td className="p-2" dir="ltr">{r.code}</td>
                <td className="p-2" style={{ paddingRight: 8 + depth(r) * 18 }}>{r.name}</td>
                <td className="p-2 text-xs">{LEVELS[r.level]}</td><td className="p-2 text-xs">{TYPES[r.type]}</td>
                <td className="p-2 text-xs">{r.balance.toLocaleString("fa-IR")}</td>
                <td className="p-2"><div className="flex gap-1">
                  <button className="btn-sm" onClick={() => { const n = window.prompt("نام جدید حساب:", r.name); if (n) act(`/api/admin/accounts/${r.id}`, { name: n }, "ذخیره شد"); }}>تغییر نام</button>
                  <button className="btn-sm" onClick={() => window.confirm("حذف حساب؟") && act(`/api/admin/accounts/${r.id}`, { delete: true }, "حذف شد")}><Trash2 className="h-3 w-3 text-rose-500" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-fit space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
        <b>تعریف حساب جدید</b>
        <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value, parentId: "" })} className="input"><option value="group">گروه حساب</option><option value="general">حساب کل</option><option value="subsidiary">حساب معین</option></select>
        {f.level === "group" ? <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="input">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          : <select value={f.parentId} onChange={(e) => { const p = rows.find((r) => r.id === Number(e.target.value)); setF({ ...f, parentId: e.target.value, code: p ? p.code : f.code }); }} className="input"><option value="">— حساب والد —</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}</select>}
        <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "") })} placeholder="کد حساب" dir="ltr" className="input" />
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="نام حساب" className="input" />
        <button disabled={busy} className="btn-primary w-full" onClick={async () => { setBusy(true); await act("/api/admin/accounts", f, "حساب ایجاد شد"); setBusy(false); setF({ ...f, code: "", name: "" }); }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ایجاد حساب</button>
        <p className="text-xs text-slate-400">ثبت اسناد فقط روی حساب‌های معین انجام می‌شود. کد فرزند باید با کد والد شروع شود.</p>
      </div>
    </div>
  );
}

type Dt = { id: number; code: string; name: string; level: number; parentId: number | null; isActive: boolean };
export function DetailManager({ rows }: { rows: Dt[] }) {
  const router = useRouter();
  const [f, setF] = useState({ parentId: "", code: "", name: "" });
  const roots = rows.filter((r) => r.level === 1);
  const kids = (id: number) => rows.filter((r) => r.parentId === id);
  const act = async (url: string, data: Record<string, unknown>, ok: string) => {
    try { await api(url, "POST", data); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, false); }
  };
  const Node = ({ r }: { r: Dt }) => (
    <>
      <div className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 ${r.isActive ? "" : "opacity-50"}`} style={{ paddingRight: 8 + (r.level - 1) * 24 }}>
        <span><span className="ml-2 rounded bg-emerald-50 px-1.5 text-[10px] text-emerald-700">سطح {r.level.toLocaleString("fa-IR")}</span><b dir="ltr" className="ml-2 text-xs">{r.code}</b>{r.name}</span>
        <div className="flex gap-1">
          {r.level < 3 && <button className="btn-sm" onClick={() => setF({ parentId: String(r.id), code: `${r.code}-`, name: "" })}>+ زیرمجموعه</button>}
          <button className="btn-sm" onClick={() => { const n = window.prompt("نام:", r.name); if (n) act(`/api/admin/detail-accounts/${r.id}`, { name: n }, "ذخیره شد"); }}>ویرایش</button>
          <button className="btn-sm" onClick={() => act(`/api/admin/detail-accounts/${r.id}`, { isActive: !r.isActive }, "ذخیره شد")}>{r.isActive ? "غیرفعال" : "فعال"}</button>
        </div>
      </div>
      {kids(r.id).map((k) => <Node key={k.id} r={k} />)}
    </>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>{roots.map((r) => <Node key={r.id} r={r} />)}</div>
      <div className="h-fit space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
        <b>تعریف حساب تفصیلی</b>
        <select value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })} className="input"><option value="">— سطح ۱ (بدون والد) —</option>{rows.filter((r) => r.level < 3).map((r) => <option key={r.id} value={r.id}>{"— ".repeat(r.level - 1)}{r.code} {r.name} (سطح {r.level})</option>)}</select>
        <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="کد تفصیلی" dir="ltr" className="input" />
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="نام (شخص، مرکز هزینه، پروژه...)" className="input" />
        <button className="btn-primary w-full" onClick={async () => { await act("/api/admin/detail-accounts", f, "تفصیلی ایجاد شد"); setF({ parentId: f.parentId, code: "", name: "" }); }}>ایجاد</button>
        <p className="text-xs text-slate-400">تفصیلی‌ها حداکثر ۳ سطح دارند و در ثبت سند برای هر آرتیکل قابل انتخاب‌اند. برای هر فروشنده به‌صورت خودکار تفصیلی سطح ۳ ساخته و به اسناد خودکار متصل می‌شود.</p>
      </div>
    </div>
  );
}
