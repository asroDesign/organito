"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import { api, toast } from "./client";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { todayIso } from "@/lib/jalali";

export type CarrierLite = { id: number; name: string };

export function ShipmentActions({ id, status, base, allowDeliver, carriers = [], defaultCarrierId }: { id: number; status: string; base: string; allowDeliver?: boolean; carriers?: CarrierLite[]; defaultCarrierId?: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [carrierId, setCarrierId] = useState<number | "">(defaultCarrierId ?? carriers[0]?.id ?? "");
  const [tracking, setTracking] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [pk, setPk] = useState(1);
  const go = async (next: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try { await api(`${base}/${id}`, "POST", { status: next, ...extra }); toast("وضعیت مرسوله به‌روزرسانی شد"); router.refresh(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  };
  const editor = ["shipped", "delivered", "ready", "preparing"].includes(status) ? <ShipmentInfoEditor id={id} base={base} carriers={carriers} /> : null;
  if (busy) return <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />;
  if (status === "pending") return <button className="btn-sm" onClick={() => go("preparing")}>تأیید و شروع آماده‌سازی</button>;
  if (status === "preparing") return <div className="flex items-center gap-2"><input type="number" min={1} value={pk} onChange={(e) => setPk(Number(e.target.value))} className="input !w-20" title="تعداد بسته" /><button className="btn-sm" onClick={() => go("ready", { packageCount: pk })}>ثبت بسته‌بندی / آماده ارسال</button></div>;
  if (status === "ready") return (
    <div className="grid w-full gap-2 rounded-xl bg-emerald-50 p-3 sm:grid-cols-2 lg:w-[520px]">
      <select value={carrierId} onChange={(e) => setCarrierId(Number(e.target.value))} className="input">{carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="کد رهگیری مرسوله" className="input" dir="ltr" />
      <JalaliDatePicker value={date} onChange={setDate} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="توضیحات ارسال (اختیاری)" className="input" />
      <button className="btn-success sm:col-span-2" disabled={!tracking || !carrierId} onClick={() => go("shipped", { carrierId, trackingNumber: tracking, shippedAt: date, notes })}>ثبت ارسال مرسوله</button>
    </div>
  );
  if (status === "shipped") return <div className="flex gap-2">{allowDeliver && <button className="btn-success" onClick={() => go("delivered")}>ثبت تحویل</button>}{editor}</div>;
  return editor;
}

export function ShipmentInfoEditor({ id, base, carriers, initial }: { id: number; base: string; carriers: CarrierLite[]; initial?: { carrierId?: number | null; trackingNumber?: string | null; shippedAt?: string | null; notes?: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ carrierId: initial?.carrierId ?? "", trackingNumber: initial?.trackingNumber ?? "", shippedAt: initial?.shippedAt ?? "", notes: initial?.notes ?? "" });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className="btn-sm" onClick={() => setOpen(true)}><Pencil className="h-3 w-3" />ویرایش اطلاعات ارسال</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b>ویرایش اطلاعات ارسال مرسوله #{id}</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <label className="block">شرکت پستی<select value={f.carrierId} onChange={(e) => setF({ ...f, carrierId: Number(e.target.value) })} className="input mt-1"><option value="">— بدون تغییر —</option>{carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="block">کد رهگیری<input value={f.trackingNumber} onChange={(e) => setF({ ...f, trackingNumber: e.target.value })} dir="ltr" className="input mt-1" /></label>
            <label className="block">تاریخ ارسال<JalaliDatePicker value={f.shippedAt} onChange={(v) => setF({ ...f, shippedAt: v })} allowEmpty /></label>
            <label className="block">توضیحات<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="input mt-1 min-h-20" /></label>
            <button disabled={busy} className="btn-primary w-full" onClick={async () => {
              setBusy(true);
              try { await api(`${base}/${id}/info`, "POST", f); toast("اطلاعات ارسال ذخیره شد"); setOpen(false); router.refresh(); }
              catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
            }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره</button>
          </div>
        </div>
      )}
    </>
  );
}
