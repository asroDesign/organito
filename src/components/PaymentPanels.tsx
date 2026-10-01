"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Receipt, X, Upload } from "lucide-react";
import { api, toast, uid } from "./client";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { todayIso } from "@/lib/jalali";
import { currencyUnit } from "@/lib/util";

const METHODS: [string, string][] = [["card_to_card", "کارت به کارت"], ["bank_transfer", "حواله / واریز بانکی (پایا، ساتنا)"], ["cash", "نقدی"], ["pos", "کارتخوان"], ["gateway", "درگاه اینترنتی (ثبت دستی)"]];

function PayFields({ f, setF, withMethod, methods = METHODS }: { f: Record<string, string>; setF: (v: Record<string, string>) => void; withMethod?: boolean; methods?: [string, string][] }) {
  const needRef = ["card_to_card", "bank_transfer"].includes(f.method);
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      {withMethod && <label className="sm:col-span-2">روش پرداخت<select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="input mt-1">{methods.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
      <label>نام واریزکننده<input value={f.payerName ?? ""} onChange={(e) => setF({ ...f, payerName: e.target.value })} className="input mt-1" /></label>
      <label>بانک مبدأ<input value={f.bankName ?? ""} onChange={(e) => setF({ ...f, bankName: e.target.value })} className="input mt-1" /></label>
      <label>۴ رقم آخر کارت مبدأ<input value={f.cardLast4 ?? ""} maxLength={4} onChange={(e) => setF({ ...f, cardLast4: e.target.value.replace(/\D/g, "") })} dir="ltr" className="input mt-1" /></label>
      <label>شماره پیگیری / مرجع {needRef && <span className="text-rose-500">*</span>}<input value={f.trackingCode ?? ""} onChange={(e) => setF({ ...f, trackingCode: e.target.value })} dir="ltr" className="input mt-1" /></label>
      <label>تاریخ واریز<JalaliDatePicker value={f.paidAt} onChange={(v) => setF({ ...f, paidAt: v })} /></label>
      <label>ساعت<input type="time" value={f.paidTime ?? ""} onChange={(e) => setF({ ...f, paidTime: e.target.value })} dir="ltr" className="input mt-1" /></label>
      <label className="sm:col-span-2">توضیحات<textarea value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value })} className="input mt-1 min-h-16" /></label>
    </div>
  );
}

/** Customer: submit card-to-card / transfer receipt. */
export function ManualPaymentForm({ orderId, amount, bankInfo }: { orderId: number; amount: number; bankInfo: string }) {
  const router = useRouter();
  const key = useRef(uid());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);
  const [f, setF] = useState<Record<string, string>>({ method: "card_to_card", paidAt: todayIso() });
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}><Receipt className="h-4 w-4" />پرداخت کارت به کارت / حواله</button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b>ثبت فیش کارت به کارت / حواله</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <div className="rounded-xl bg-emerald-50 p-3 text-sm leading-7">مبلغ <b>{amount.toLocaleString("fa-IR")} {currencyUnit()}</b> را به حساب زیر واریز و مشخصات را ثبت کنید:<div className="mt-1 font-bold">{bankInfo}</div></div>
            <PayFields f={f} setF={setF} withMethod methods={METHODS.slice(0, 2)} />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
              <Upload className="h-4 w-4" />{receipt ? "تصویر فیش بارگذاری شد ✓" : "بارگذاری تصویر فیش (اختیاری)"}
              <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const fd = new FormData(); fd.append("file", file);
                const r = await fetch("/api/media", { method: "POST", body: fd, headers: { "x-csrf": "1" } }); const j = await r.json();
                if (r.ok) setReceipt(j.id); else toast(j.error, false);
              }} />
            </label>
            <button disabled={busy} className="btn-primary w-full" onClick={async () => {
              setBusy(true);
              try { await api(`/api/orders/${orderId}/manual-payment`, "POST", { ...f, receiptMediaId: receipt, idempotencyKey: key.current }); toast("فیش ثبت شد و پس از تأیید مدیر، سفارش پردازش می‌شود"); setOpen(false); router.refresh(); }
              catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
            }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت اطلاعات پرداخت</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Admin: record a payment manually (changes status to paid). */
export function AdminRecordPayment({ orderId, amount }: { orderId: number; amount: number }) {
  const router = useRouter();
  const key = useRef(uid());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, string>>({ method: "card_to_card", paidAt: todayIso() });
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}><CreditCard className="h-4 w-4" />ثبت پرداخت / تغییر وضعیت به پرداخت‌شده</button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b>ثبت پرداخت سفارش — {amount.toLocaleString("fa-IR")} {currencyUnit()}</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <PayFields f={f} setF={setF} withMethod />
            <p className="text-xs text-slate-500">با ثبت، وضعیت سفارش «پرداخت‌شده» می‌شود، سند حسابداری صادر و سهم فروشندگان به کیف پول در انتظار منتقل می‌شود. اطلاعات در فاکتور چاپ می‌شود.</p>
            <button disabled={busy} className="btn-primary w-full" onClick={async () => {
              setBusy(true);
              try { await api(`/api/admin/orders/${orderId}/payment`, "POST", { action: "record", ...f, idempotencyKey: key.current }); toast("پرداخت ثبت شد"); setOpen(false); router.refresh(); }
              catch (e) { toast((e as Error).message, false); key.current = uid(); } finally { setBusy(false); }
            }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت پرداخت</button>
          </div>
        </div>
      )}
    </>
  );
}
