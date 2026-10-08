"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Printer, X, UserCheck } from "lucide-react";
import { api, toast } from "./client";

export type IssueLite = { id: number; number: string; status: string; receiverName: string | null; handedOverAt: string | null };
const ST: Record<string, [string, string]> = { issued: ["صادرشده — در انتظار تحویل", "bg-amber-100 text-amber-800"], delivered: ["تحویل مأمور ارسال شد", "bg-emerald-100 text-emerald-800"], cancelled: ["ابطال‌شده", "bg-slate-200 text-slate-600"] };

/** Warehouse exit slip actions for a shipment (used in admin order page, seller order page and admin issues list). */
export function IssuePanel({ shipmentId, issue, canIssue, packageCount = 1 }: { shipmentId: number; issue: IssueLite | null; canIssue: boolean; packageCount?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | "create" | "handover">(null);
  const [f, setF] = useState<Record<string, string>>({ packageCount: String(packageCount), receiverRole: "مأمور ارسال / پیک" });
  const run = async (url: string, data: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await api(url, "POST", data); toast(ok); setOpen(null); router.refresh(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  };
  const active = issue && issue.status !== "cancelled" ? issue : null;
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-700"><ClipboardList className="h-4 w-4 text-emerald-600" />حواله خروج از انبار</span>
        {active ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <b dir="ltr" className="font-mono">{active.number}</b>
            <span className={`rounded-full px-2 py-0.5 ${ST[active.status][1]}`}>{ST[active.status][0]}</span>
            <a href={`/print/issue/${active.id}`} target="_blank" className="btn-sm"><Printer className="h-3 w-3" />چاپ حواله</a>
            {canIssue && active.status === "issued" && <button className="btn-success" onClick={() => setOpen("handover")}><UserCheck className="h-3 w-3" />ثبت تحویل به مأمور</button>}
            {canIssue && active.status === "issued" && <button className="btn-sm" disabled={busy} onClick={() => { const r = window.prompt("دلیل ابطال حواله:"); if (r) run(`/api/warehouse-issues/${active.id}/cancel`, { reason: r }, "حواله ابطال شد"); }}>ابطال</button>}
          </div>
        ) : canIssue ? <button className="btn-sm !border-emerald-300 !text-emerald-700" onClick={() => setOpen("create")}>+ صدور حواله خروج</button> : <span className="text-slate-400">صادر نشده</span>}
      </div>
      {active?.status === "delivered" && <div className="mt-1.5 text-slate-500">تحویل‌گیرنده: <b className="text-slate-700">{active.receiverName}</b></div>}
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4" onClick={() => setOpen(null)}>
          <div className="modal-scroll-panel w-full max-w-md space-y-3 rounded-2xl bg-white p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b>{open === "create" ? `صدور حواله خروج — مرسوله #${shipmentId}` : `ثبت تحویل کالا طبق حواله ${active?.number}`}</b><button onClick={() => setOpen(null)}><X className="h-5 w-5" /></button></div>
            {open === "create" ? (
              <>
                <label className="block">تعداد بسته<input type="number" min={1} value={f.packageCount} onChange={(e) => setF({ ...f, packageCount: e.target.value })} className="input mt-1" /></label>
                <label className="block">شرکت حمل / روش ارسال (اختیاری)<input value={f.carrier ?? ""} onChange={(e) => setF({ ...f, carrier: e.target.value })} className="input mt-1" /></label>
                <label className="block">توضیحات<textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} className="input mt-1 min-h-16" /></label>
                <p className="text-xs text-slate-500">اقلام و تعداد از روی مرسوله به‌صورت خودکار در حواله درج می‌شوند و قابل تغییر نیستند.</p>
                <button disabled={busy} className="btn-primary w-full" onClick={() => run(`/api/shipments/${shipmentId}/issue`, { packageCount: Number(f.packageCount) || 1, carrier: f.carrier, notes: f.notes }, "حواله خروج صادر شد")}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}صدور حواله</button>
              </>
            ) : (
              <>
                <label className="block">نام و نام خانوادگی تحویل‌گیرنده <span className="text-rose-500">*</span><input value={f.receiverName ?? ""} onChange={(e) => setF({ ...f, receiverName: e.target.value })} className="input mt-1" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label>کد ملی<input value={f.receiverNationalId ?? ""} maxLength={10} onChange={(e) => setF({ ...f, receiverNationalId: e.target.value.replace(/\D/g, "") })} dir="ltr" className="input mt-1" /></label>
                  <label>موبایل<input value={f.receiverPhone ?? ""} onChange={(e) => setF({ ...f, receiverPhone: e.target.value })} dir="ltr" className="input mt-1" /></label>
                </div>
                <label className="block">سمت<input value={f.receiverRole ?? ""} onChange={(e) => setF({ ...f, receiverRole: e.target.value })} className="input mt-1" /></label>
                <button disabled={busy || !f.receiverName} className="btn-success w-full !py-2.5" onClick={() => run(`/api/warehouse-issues/${active!.id}/handover`, f, "تحویل کالا ثبت شد")}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت تحویل</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
