"use client";
import { useState } from "react";
import { PhoneCall, Send, ShieldCheck } from "lucide-react";
import { api, toast } from "./client";
import { Modal } from "./Modal";

export function ProductInquiryButton({ productId, productName, variantId, variantTitle, customer }: { productId: number; productName: string; variantId?: number | null; variantTitle?: string; customer?: { name: string; phone: string } | null }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [sentNumber, setSentNumber] = useState("");
  const [name, setName] = useState(customer?.name ?? ""), [phone, setPhone] = useState(customer?.phone ?? ""), [message, setMessage] = useState(""), [consent, setConsent] = useState(false), [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{ number: string }>("/api/product-inquiries", "POST", { productId, variantId: variantId ?? null, name, phone, message, consent });
      setSentNumber(result.number); toast("درخواست استعلام شما ثبت شد");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => { setSentNumber(""); setError(""); setOpen(true); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 to-yellow-300 py-3.5 font-black text-amber-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-yellow-200"><PhoneCall className="size-5"/>استعلام قیمت و موجودی</button>
    <p className="mt-2 text-center text-xs leading-6 text-slate-500">قیمت و موجودی این {variantTitle ? "تنوع" : "محصول"} تلفنی اعلام می‌شود.</p>
    {open && <Modal title="درخواست استعلام محصول" onClose={() => !busy && setOpen(false)}>
      {sentNumber ? <div className="space-y-4 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><ShieldCheck className="size-7"/></span><h3 className="text-lg font-black text-emerald-950">درخواست ثبت شد</h3><p className="text-sm leading-7 text-slate-600">درخواست {productName}{variantTitle ? `، تنوع ${variantTitle}` : ""} با شمارهٔ <b dir="ltr">{sentNumber}</b> ثبت شد. همکاران فروش با شما تماس می‌گیرند.</p><button type="button" className="btn-primary mx-auto" onClick={() => setOpen(false)}>متوجه شدم</button></div> : <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><b>{productName}</b>{variantTitle && <span className="mr-1">· {variantTitle}</span>}<p className="mt-1 text-xs text-amber-800">برای دریافت قیمت و موجودی، راه تماس خود را ثبت کنید.</p></div>
        <label className="block text-sm font-bold">نام و نام خانوادگی<input required maxLength={100} className="input mt-1" value={name} onChange={(e) => setName(e.target.value)}/></label>
        <label className="block text-sm font-bold">شماره موبایل<input required inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} placeholder="09xxxxxxxxx" className="input mt-1 text-left" value={phone} onChange={(e) => setPhone(e.target.value)}/></label>
        <label className="block text-sm font-bold">توضیح یا زمان مناسب تماس <span className="font-normal text-slate-400">(اختیاری)</span><textarea maxLength={1500} rows={3} className="input mt-1" value={message} onChange={(e) => setMessage(e.target.value)}/></label>
        <label className="flex items-start gap-2 text-xs leading-6 text-slate-600"><input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-emerald-600"/><span>با ثبت این درخواست، برای تماس دربارهٔ همین محصول رضایت می‌دهم. اطلاعات فقط برای پیگیری این استعلام استفاده می‌شود.</span></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full"><Send className="size-4"/>{busy ? "در حال ثبت…" : "ثبت درخواست تماس"}</button>
      </form>}
    </Modal>}
  </>;
}
