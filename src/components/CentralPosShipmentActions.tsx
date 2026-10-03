"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toast } from "./client";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { todayIso } from "@/lib/jalali";

type Carrier = { id: number; name: string };
export function CentralPosShipmentActions({ id, status, carrierId, trackingNumber, shippedAt, notes, carriers }: {
  id: number; status: string; carrierId: number | null; trackingNumber: string | null; shippedAt: string | null; notes: string | null; carriers: Carrier[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState(String(carrierId ?? carriers[0]?.id ?? ""));
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [date, setDate] = useState(shippedAt ?? todayIso());
  const [note, setNote] = useState(notes ?? "");
  const update = async (next: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try { await api(`/api/admin/pos/${id}/shipping`, "POST", { status: next, ...extra }); toast("وضعیت ارسال فاکتور به‌روزرسانی شد"); router.refresh(); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  if (busy) return <Loader2 className="size-5 animate-spin text-emerald-700"/>;
  if (status === "pending") return <button className="btn-sm" onClick={() => void update("preparing")}>شروع آماده‌سازی</button>;
  if (status === "preparing") return <button className="btn-sm" onClick={() => void update("ready")}>آماده ارسال</button>;
  if (status === "ready") return <div className="min-w-56 space-y-2">
    <select className="input !py-1.5" value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)}><option value="">انتخاب شرکت پستی</option>{carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}</select>
    <input className="input !py-1.5" dir="ltr" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="کد رهگیری"/>
    <JalaliDatePicker value={date} onChange={setDate}/>
    <input className="input !py-1.5" value={note} onChange={e => setNote(e.target.value)} placeholder="توضیحات ارسال"/>
    <button className="btn-success w-full" disabled={!selectedCarrier || !tracking || !date} onClick={() => void update("shipped", { carrierId: Number(selectedCarrier), trackingNumber: tracking, shippedAt: date, notes: note })}>ثبت ارسال</button>
  </div>;
  if (status === "shipped") return <button className="btn-success" onClick={() => void update("delivered")}>ثبت تحویل</button>;
  return <span className="text-xs text-slate-500">ارسال تکمیل شده است</span>;
}
