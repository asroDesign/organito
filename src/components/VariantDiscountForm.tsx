"use client";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, toast } from "./client";
import { JalaliDateTimePicker } from "./JalaliDateTimePicker";

type VariantOption = { id: number; productId: number; productName: string; sku: string; title: string; price: number; cost: number };
const toman = (value: number) => `${Math.max(0, Math.round(value)).toLocaleString("fa-IR")} تومان`;

export function VariantDiscountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [rows, setRows] = useState<VariantOption[]>([]), [selected, setSelected] = useState<VariantOption | null>(null);
  const [startsDate, setStartsDate] = useState(""), [startsTime, setStartsTime] = useState("12:00"), [endsDate, setEndsDate] = useState(""), [endsTime, setEndsTime] = useState("23:59"), [busy, setBusy] = useState(false);
  const search = async () => {
    if (query.trim().length < 2) return toast("حداقل دو حرف از نام یا کد کالا را وارد کنید", false);
    setBusy(true);
    try { setRows(await api<VariantOption[]>(`/api/admin/variant-discounts/variants?q=${encodeURIComponent(query.trim())}`, "GET")); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const enterSearch = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); void search(); } };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return toast("یک تنوع را انتخاب کنید", false);
    if (!startsDate || !endsDate) return toast("تاریخ شروع و پایان را با تقویم شمسی مشخص کنید", false);
    const startsAt = `${startsDate}T${startsTime}`, endsAt = `${endsDate}T${endsTime}`;
    if (endsAt <= startsAt) return toast("پایان تخفیف باید بعد از شروع آن باشد", false);
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api("/api/admin/variant-discounts", "POST", { variantId: selected.id, title: data.get("title"), discountPercent: Number(data.get("discountPercent")), startsAt, endsAt });
      toast("تخفیف زمان‌بندی‌شدهٔ تنوع ثبت شد");
      router.refresh();
      event.currentTarget.reset(); setSelected(null); setStartsDate(""); setEndsDate("");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  return <>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-xs font-bold">عنوان کمپین<input name="title" required maxLength={120} className="input mt-1" placeholder="تخفیف ویژه تنوع یک کیلویی" /></label>
      <div className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><b className="block text-xs">تنوع کالا</b><p className="mt-1 truncate text-xs text-slate-500">{selected ? `${selected.productName} · ${selected.title} · ${selected.sku}` : "هنوز تنوعی انتخاب نشده"}</p></div><button type="button" className="btn-sm shrink-0" onClick={() => setOpen(true)}><Search className="size-3.5"/>جستجو و انتخاب</button></div></div>
      {selected && <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">قیمت فعلی: <b>{toman(selected.price)}</b> · بهای خرید: <b>{toman(selected.cost)}</b><p>درصد بالاتر از حاشیه امن فعلی، یا ناسازگار با قیمت تعدادی، سمت سرور رد می‌شود.</p></div>}
      <label className="block text-xs font-bold">درصد تخفیف<input name="discountPercent" type="number" min="1" max="90" required className="input mt-1" placeholder="مثلاً ۱۵" /></label>
      <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3 sm:grid-cols-2"><label className="text-xs font-bold">شروع<div className="mt-1"><JalaliDateTimePicker name="startsAt" date={startsDate} time={startsTime} onDateChange={setStartsDate} onTimeChange={setStartsTime}/></div></label><label className="text-xs font-bold">پایان<div className="mt-1"><JalaliDateTimePicker name="endsAt" date={endsDate} time={endsTime} onDateChange={setEndsDate} onTimeChange={setEndsTime}/></div></label><p className="text-xs leading-5 text-slate-500 sm:col-span-2">ساعت‌ها بر اساس وقت تهران ثبت می‌شوند. بازه‌های هم‌پوشان برای یک تنوع پذیرفته نمی‌شوند.</p></div>
      <button disabled={busy} className="btn-primary w-full">{busy ? "در حال ثبت…" : "زمان‌بندی تخفیف"}</button>
    </form>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="انتخاب تنوع کالا"><section className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-4"><b>جستجو و انتخاب تنوع</b><button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="btn-ghost"><X className="size-4"/></button></header><div className="flex gap-2 p-4"><input autoFocus className="input min-w-0" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={enterSearch} placeholder="نام محصول، SKU یا نام تنوع"/><button type="button" className="btn-primary shrink-0" onClick={() => void search()} disabled={busy}>{busy ? "جستجو…" : "جستجو"}</button></div><div className="min-h-0 flex-1 overflow-y-auto px-4">{rows.map(row => <button type="button" key={row.id} onClick={() => { setSelected(row); setOpen(false); }} className={`flex w-full flex-wrap items-center gap-3 border-b p-3 text-right hover:bg-amber-50 ${selected?.id === row.id ? "bg-amber-50" : ""}`}><span className="min-w-0 flex-1"><b className="block">{row.productName} · {row.title}</b><small className="mt-1 block text-slate-400" dir="ltr">{row.sku}</small></span><span className="text-left text-xs text-slate-500">قیمت {toman(row.price)}<small className="block">بهای خرید {toman(row.cost)}</small></span></button>)}{!rows.length && <p className="p-8 text-center text-sm text-slate-500">برای شروع، نام یا کد کالا را جستجو کنید.</p>}</div><footer className="flex justify-end border-t p-4"><button type="button" onClick={() => setOpen(false)} className="btn-ghost">بستن</button></footer></section></div>}
  </>;
}
