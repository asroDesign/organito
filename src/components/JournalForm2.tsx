"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { api, toast } from "./client";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { todayIso } from "@/lib/jalali";

type D = { id: number; code: string; name: string; level: number; parentId: number | null };
type L = { code: string; debit: number; credit: number; description: string; detail1Id: number | null; detail2Id: number | null; detail3Id: number | null };

export function JournalForm2({ accounts, details }: { accounts: [string, string][]; details: D[] }) {
  const router = useRouter();
  const blank = (): L => ({ code: accounts[0]?.[0] ?? "", debit: 0, credit: 0, description: "", detail1Id: null, detail2Id: null, detail3Id: null });
  const [date, setDate] = useState(todayIso());
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState<L[]>([blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const d = lines.reduce((a, l) => a + (l.debit || 0), 0), c = lines.reduce((a, l) => a + (l.credit || 0), 0);
  const upd = (i: number, p: Partial<L>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const lv = (level: number, parent: number | null) => details.filter((x) => x.level === level && (level === 1 || !parent || x.parentId === parent));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <label className="text-sm">تاریخ سند (شمسی)<JalaliDatePicker value={date} onChange={setDate} /></label>
        <label className="text-sm">شرح سند<input value={desc} onChange={(e) => setDesc(e.target.value)} className="input mt-1" /></label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="p-1 text-right">#</th><th className="p-1 text-right">حساب معین</th><th className="p-1 text-right">تفصیلی سطح ۱</th><th className="p-1 text-right">تفصیلی سطح ۲</th><th className="p-1 text-right">تفصیلی سطح ۳</th><th className="p-1 text-right">شرح آرتیکل</th><th className="p-1 text-right">بدهکار</th><th className="p-1 text-right">بستانکار</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-1 text-slate-400">{(i + 1).toLocaleString("fa-IR")}</td>
                <td className="p-1"><select value={l.code} onChange={(e) => upd(i, { code: e.target.value })} className="input">{accounts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
                <td className="p-1"><select value={l.detail1Id ?? ""} onChange={(e) => upd(i, { detail1Id: e.target.value ? Number(e.target.value) : null, detail2Id: null, detail3Id: null })} className="input"><option value="">—</option>{lv(1, null).map((x) => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}</select></td>
                <td className="p-1"><select value={l.detail2Id ?? ""} onChange={(e) => upd(i, { detail2Id: e.target.value ? Number(e.target.value) : null, detail3Id: null })} className="input"><option value="">—</option>{lv(2, l.detail1Id).map((x) => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}</select></td>
                <td className="p-1"><select value={l.detail3Id ?? ""} onChange={(e) => upd(i, { detail3Id: e.target.value ? Number(e.target.value) : null })} className="input"><option value="">—</option>{lv(3, l.detail2Id).map((x) => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}</select></td>
                <td className="p-1"><input value={l.description} onChange={(e) => upd(i, { description: e.target.value })} className="input" /></td>
                <td className="p-1"><input type="number" min={0} value={l.debit || ""} onChange={(e) => upd(i, { debit: Number(e.target.value), credit: 0 })} className="input w-32" /></td>
                <td className="p-1"><input type="number" min={0} value={l.credit || ""} onChange={(e) => upd(i, { credit: Number(e.target.value), debit: 0 })} className="input w-32" /></td>
                <td className="p-1"><button onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-500" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-sm" onClick={() => setLines([...lines, blank()])}><Plus className="h-3 w-3" />افزودن آرتیکل</button>
        <span className={`text-sm ${d === c && d > 0 ? "text-emerald-600" : "text-rose-600"}`}>بدهکار {d.toLocaleString("fa-IR")} · بستانکار {c.toLocaleString("fa-IR")} {d === c && d > 0 ? "✓ متوازن" : `✗ اختلاف ${Math.abs(d - c).toLocaleString("fa-IR")}`}</span>
        <button disabled={busy || d !== c || d === 0} className="btn-primary" onClick={async () => {
          setBusy(true);
          try { await api("/api/admin/journal2", "POST", { date, description: desc, lines }); toast("سند ثبت شد"); router.push("?tab=journal"); router.refresh(); }
          catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
        }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت سند</button>
      </div>
    </div>
  );
}
