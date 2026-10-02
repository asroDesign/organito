"use client";

import { useState } from "react";
import { Loader2, MessageSquareText, Percent, Save } from "lucide-react";
import { api, toast } from "./client";

export function IncompleteCartActions({ id, initialReason, allowed }: { id: number; initialReason: string; allowed: boolean }) {
  const [reason, setReason] = useState(initialReason);
  const [busy, setBusy] = useState("");
  const act = async (action: string) => {
    if (!allowed) return toast("این مشتری اجازه دریافت پیامک تبلیغاتی نداده است", false);
    let percent = 10;
    if (action === "discount") {
      const raw = window.prompt("درصد تخفیف (۱ تا ۵۰)", "۱۰");
      if (raw === null) return;
      percent = Number(raw);
      if (!Number.isInteger(percent) || percent < 1 || percent > 50) return toast("درصد تخفیف باید بین ۱ تا ۵۰ باشد", false);
      if (!window.confirm(`ارسال کد تخفیف ${percent}٪ با اعتبار ۷ روزه انجام شود؟`)) return;
    }
    setBusy(action);
    try {
      const out = await api<{ status: string; code?: string }>(`/api/admin/incomplete-carts/${id}`, "POST", { action, percent });
      toast(out.code ? `کد ${out.code} — وضعیت ارسال: ${out.status}` : `وضعیت ارسال پیامک: ${out.status}`, out.status === "sent" || out.status === "simulated");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(""); }
  };
  return <div className="min-w-64 space-y-2">
    <div className="flex gap-1"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="دلیل ناقص ماندن" className="input !h-9 text-xs" /><button type="button" title="ذخیره دلیل" disabled={!!busy || !reason.trim()} className="btn-sm !px-2" onClick={async () => { setBusy("reason"); try { await api(`/api/admin/incomplete-carts/${id}`, "POST", { reason }); toast("دلیل ذخیره شد"); } catch (error) { toast((error as Error).message, false); } finally { setBusy(""); } }}><Save className="size-4" /></button></div>
    <div className="flex flex-wrap gap-1"><button type="button" disabled={!!busy || !allowed} onClick={() => void act("reminder")} className="btn-sm">{busy === "reminder" ? <Loader2 className="size-3 animate-spin" /> : <MessageSquareText className="size-3" />}یادآوری خرید</button><button type="button" disabled={!!busy || !allowed} onClick={() => void act("discount")} className="btn-sm">{busy === "discount" ? <Loader2 className="size-3 animate-spin" /> : <Percent className="size-3" />}ارسال کد تخفیف</button></div>
    {!allowed && <div className="text-[10px] text-amber-700">رضایت پیامک تبلیغاتی ثبت نشده است.</div>}
  </div>;
}
