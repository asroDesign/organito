"use client";
import { useState } from "react";
import { BellRing, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "./client";

type Variant = { id: number; title: string; available: number };
export function ProductAlerts({ productId, productName, phone, variants }: { productId: number; productName: string; phone?: string; variants: Variant[] }) {
  const [open, setOpen] = useState(false), [selectedVariant, setSelectedVariant] = useState("0"), [mobile, setMobile] = useState(phone ?? "");
  const [restock, setRestock] = useState(true), [priceDrop, setPriceDrop] = useState(true), [consent, setConsent] = useState(false);
  const [verificationId, setVerificationId] = useState<number | null>(null), [code, setCode] = useState(""), [busy, setBusy] = useState(false), [complete, setComplete] = useState(false);
  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/product-alerts/request-code", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf": "1" }, body: JSON.stringify({ phone: mobile, productId, variantId: Number(selectedVariant), alertRestock: restock, alertPriceDrop: priceDrop, consent }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "ارسال کد انجام نشد");
      setVerificationId(data.verificationId); toast("کد تأیید پیامکی ارسال شد");
    } catch (e) { toast(e instanceof Error ? e.message : "خطا در ارسال کد", false); } finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); if (!verificationId) return; setBusy(true);
    try {
      const r = await fetch("/api/product-alerts/verify", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf": "1" }, body: JSON.stringify({ phone: mobile, verificationId, code }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "تأیید کد انجام نشد");
      setComplete(true); toast("اشتراک اعلان با موفقیت ثبت شد");
    } catch (e) { toast(e instanceof Error ? e.message : "خطا در تأیید", false); } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><BellRing className="size-5"/></span><div className="min-w-0 flex-1"><b className="text-sm text-slate-900">از موجودی و کاهش قیمت باخبر شوید</b><p className="mt-1 text-xs leading-6 text-slate-600">با تأیید شماره همراه، برای «{productName}» اعلان پیامکی بگیرید.</p></div><a href="/customer/alerts" className="shrink-0 text-[11px] font-bold text-emerald-800">اعلان‌های من</a></div>
    {!open && !complete && <button onClick={() => setOpen(true)} className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100">تنظیم اعلان محصول</button>}
    {complete && <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><Check className="size-4"/>شماره تأیید شد و اعلان شما ثبت شد.</div>}
    {open && !complete && <form onSubmit={verificationId ? verify : requestCode} className="mt-4 space-y-3 border-t border-amber-100 pt-4">
      {variants.length > 0 && <label className="block text-xs font-bold text-slate-700">تنوع محصول<select className="input mt-1" value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)}><option value="0">همه تنوع‌ها / خود محصول</option>{variants.map((v) => <option value={v.id} key={v.id}>{v.title}{v.available > 0 ? " · موجود" : " · ناموجود"}</option>)}</select></label>}
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700"><label className="flex items-center gap-2"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="accent-emerald-700"/>اعلان موجودشدن</label><label className="flex items-center gap-2"><input type="checkbox" checked={priceDrop} onChange={(e) => setPriceDrop(e.target.checked)} className="accent-emerald-700"/>اعلان کاهش قیمت</label></fieldset>
      {!verificationId ? <><label className="block text-xs font-bold text-slate-700">شماره همراه<input required dir="ltr" inputMode="tel" autoComplete="tel" placeholder="0912…" className="input mt-1 text-left" value={mobile} onChange={(e) => setMobile(e.target.value)}/></label><label className="flex items-start gap-2 text-[11px] leading-5 text-slate-600"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-emerald-700"/><span>رضایت می‌دهم برای همین محصول و اعلان‌های انتخابی، پیامک دریافت کنم. می‌توانم هر زمان اشتراک را لغو کنم.</span></label></> : <label className="block text-xs font-bold text-slate-700">کد پیامک‌شده<input required dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input mt-1 text-left" value={code} onChange={(e) => setCode(e.target.value)}/><button type="button" onClick={() => { setVerificationId(null); setCode(""); }} className="mt-2 text-[11px] font-bold text-emerald-800">ارسال دوباره کد</button></label>}
      <button disabled={busy || (!verificationId && (!consent || (!restock && !priceDrop)))} className="btn-primary w-full disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin"/> : <ShieldCheck className="size-4"/>}{verificationId ? "تأیید شماره و ثبت اعلان" : "ارسال کد تأیید"}</button>
      <p className="text-[10px] leading-5 text-slate-500">کد پنج دقیقه اعتبار دارد. پیام اعلان برای هر رویداد حداکثر یک بار ارسال می‌شود.</p>
    </form>}
  </section>;
}
