"use client";

import { useState } from "react";
import { Loader2, MessageSquareText, Percent, Save } from "lucide-react";
import { api, toast } from "./client";

export function IncompleteCartActions({ id, initialReason }: { id: number; initialReason: string }) {
  const [reason, setReason] = useState(initialReason);
  const [busy, setBusy] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const act = async (action: string) => {
    let percent = Number(discountPercent);
    if (action === "discount") {
      if (!Number.isInteger(percent) || percent < 1 || percent > 50) return toast("درصد تخفیف باید بین ۱ تا ۵۰ باشد", false);
      if (!window.confirm(`ارسال کد تخفیف ${percent}٪ با اعتبار ۷ روزه انجام شود؟`)) return;
    }
    setBusy(action);
    try {
      const out = await api<{ status: string; code?: string }>(`/api/admin/incomplete-carts/${id}`, "POST", { action, percent });
      const ok = out.status === "sent" || out.status === "simulated" || out.status === "partial";
      toast(out.code ? `کد ${out.code} — وضعیت ارسال: ${out.status}` : `وضعیت ارسال پیامک: ${out.status}`, ok);
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(""); }
  };
  return <div className="min-w-64 space-y-2">
    <div className="flex gap-1"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="دلیل ناقص ماندن" className="input !h-9 text-xs" /><button type="button" title="ذخیره دلیل" disabled={!!busy || !reason.trim()} className="btn-sm !px-2" onClick={async () => { setBusy("reason"); try { await api(`/api/admin/incomplete-carts/${id}`, "POST", { reason }); toast("دلیل ذخیره شد"); } catch (error) { toast((error as Error).message, false); } finally { setBusy(""); } }}><Save className="size-4" /></button></div>
    <div className="flex flex-wrap items-end gap-2">
      <button type="button" disabled={!!busy} onClick={() => void act("reminder")} className="btn-sm">{busy === "reminder" ? <Loader2 className="size-3 animate-spin" /> : <MessageSquareText className="size-3" />}یادآوری خرید</button>
      <label className="flex items-center gap-1 text-[11px] text-slate-500">درصد تخفیف
        <span className="relative"><input aria-label="درصد تخفیف سبد ناقص" type="number" min={1} max={50} step={1} inputMode="numeric" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} disabled={!!busy} className="input !h-9 !w-20 pl-6 text-center text-xs" /><span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">٪</span></span>
      </label>
      <button type="button" disabled={!!busy} onClick={() => void act("discount")} className="btn-sm">{busy === "discount" ? <Loader2 className="size-3 animate-spin" /> : <Percent className="size-3" />}ارسال کد تخفیف</button>
    </div>
  </div>;
}
