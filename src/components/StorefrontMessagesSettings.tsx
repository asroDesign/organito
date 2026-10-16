"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, Megaphone, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { api, toast, ImageUploader } from "@/components/client";
import { Modal } from "@/components/Modal";

type Product = { id: number; name: string; sku: string; imageId: number | null };
type Popup = { id: string; enabled: boolean; title: string; body: string; imageId: number; productIds: number[]; buttonLabel: string; delaySeconds: number; repeatHours: number };
type Initial = { announcementEnabled: number; announcementText: string; announcementHref: string; announcementTheme: string; specialPopups: Popup[] };
const newPopup = (): Popup => ({ id: crypto.randomUUID(), enabled: false, title: "پیشنهاد ویژه برای شما", body: "محصولات منتخب و پیشنهادهای تازه فروشگاه را ببینید.", imageId: 0, productIds: [], buttonLabel: "مشاهده پیشنهادها", delaySeconds: 5, repeatHours: 24 });

export function StorefrontMessagesSettings({ initial, initialProducts }: { initial: Initial; initialProducts: Product[] }) {
  const [bar, setBar] = useState({ enabled: Number(initial.announcementEnabled) === 1, text: initial.announcementText, href: initial.announcementHref, theme: initial.announcementTheme || "sunshine" });
  const [popups, setPopups] = useState<Popup[]>(initial.specialPopups ?? []);
  const [productChoices, setProductChoices] = useState<Record<string, Product[]>>(() => Object.fromEntries(popups.map((popup) => [popup.id, initialProducts.filter((product) => popup.productIds.includes(product.id))])));
  const [pickerId, setPickerId] = useState<string | null>(null), [query, setQuery] = useState(""), [results, setResults] = useState<Product[]>([]);
  const [barBusy, setBarBusy] = useState(false), [popupBusy, setPopupBusy] = useState(false), [searchBusy, setSearchBusy] = useState(false);

  const saveBar = async (event: FormEvent) => {
    event.preventDefault(); setBarBusy(true);
    try { await api("/api/admin/settings", "POST", { announcementEnabled: bar.enabled ? 1 : 0, announcementText: bar.text, announcementHref: bar.href, announcementTheme: bar.theme }); toast("نوار اعلان ذخیره شد"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBarBusy(false); }
  };
  const savePopups = async (event: FormEvent) => {
    event.preventDefault(); setPopupBusy(true);
    try { await api("/api/admin/settings", "POST", { specialPopups: popups }); toast("پاپ‌آپ‌های پیشنهاد ویژه ذخیره شدند"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setPopupBusy(false); }
  };
  const updatePopup = (id: string, patch: Partial<Popup>) => setPopups((items) => items.map((popup) => popup.id === id ? { ...popup, ...patch } : popup));
  const searchProducts = async () => {
    if (query.trim().length < 2) return toast("برای جستجو حداقل دو حرف یا رقم وارد کنید", false);
    setSearchBusy(true);
    try { setResults(await api<Product[]>(`/api/admin/settings/storefront-products?q=${encodeURIComponent(query.trim())}`, "GET")); }
    catch (error) { toast((error as Error).message, false); }
    finally { setSearchBusy(false); }
  };
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); void searchProducts(); } };
  const toggleProduct = (product: Product) => {
    if (!pickerId) return;
    const popup = popups.find((item) => item.id === pickerId); if (!popup) return;
    const exists = popup.productIds.includes(product.id);
    if (!exists && popup.productIds.length >= 50) return toast("برای هر پاپ‌آپ حداکثر ۵۰ محصول انتخاب کنید", false);
    updatePopup(popup.id, { productIds: exists ? popup.productIds.filter((id) => id !== product.id) : [...popup.productIds, product.id] });
    setProductChoices((current) => ({ ...current, [popup.id]: exists ? (current[popup.id] ?? []).filter((item) => item.id !== product.id) : [...(current[popup.id] ?? []), product] }));
  };

  return <div className="space-y-6">
    <section className="rounded-2xl border border-amber-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Megaphone className="size-5"/></span><div><h2 className="font-black">نوار اعلان سراسری</h2><p className="mt-1 text-xs leading-6 text-slate-500">پیام بالای صفحات فروشگاه مثل ارسال رایگان یا جشنواره؛ پیوند می‌تواند داخلی یا HTTPS باشد.</p></div></div>
      <form onSubmit={saveBar} className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold md:col-span-2"><input type="checkbox" checked={bar.enabled} onChange={(event) => setBar({ ...bar, enabled: event.target.checked })} className="size-4 accent-amber-500"/>فعال‌سازی نوار اعلان</label>
        <label className="text-xs font-bold md:col-span-2">متن اعلان<textarea maxLength={300} value={bar.text} onChange={(event) => setBar({ ...bar, text: event.target.value })} className="input mt-1 min-h-20" placeholder="مثلاً ارسال رایگان برای سفارش‌های بالای ..."/></label>
        <label className="text-xs font-bold">پیوند (اختیاری)<input maxLength={500} value={bar.href} onChange={(event) => setBar({ ...bar, href: event.target.value })} className="input mt-1" dir="ltr" placeholder="/shop?fest=1 یا https://…"/></label>
        <label className="text-xs font-bold">رنگ نوار<select value={bar.theme} onChange={(event) => setBar({ ...bar, theme: event.target.value })} className="input mt-1"><option value="sunshine">زرد آفتابی</option><option value="forest">سبز تیره</option><option value="rose">قرمز جشنواره</option></select></label>
        <div className={`rounded-xl p-3 text-center text-sm font-bold ${bar.theme === "forest" ? "bg-emerald-900 text-white" : bar.theme === "rose" ? "bg-rose-600 text-white" : "bg-amber-400 text-amber-950"}`}>{bar.text || "پیش‌نمایش پیام نوار اعلان"}{bar.href && <span className="mr-2 underline">مشاهده</span>}</div>
        <button disabled={barBusy} className="btn-primary md:justify-self-end">{barBusy ? "در حال ذخیره…" : "ذخیره نوار اعلان"}</button>
      </form>
    </section>

    <section className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Sparkles className="size-5"/></span><div><h2 className="font-black">پاپ‌آپ‌های پیشنهاد ویژه</h2><p className="mt-1 text-xs leading-6 text-slate-500">تا ۱۰ پاپ‌آپ تعریف کنید و برای هرکدام محصولات مقصد را جداگانه انتخاب کنید.</p></div></div><button type="button" disabled={popups.length >= 10} onClick={() => { const popup = newPopup(); setPopups((items) => [...items, popup]); setProductChoices((current) => ({ ...current, [popup.id]: [] })); }} className="btn-sm"><Plus className="size-4"/>افزودن پاپ‌آپ</button></div>
      {!popups.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">هنوز پاپ‌آپی تعریف نشده است.</p>}
      <form onSubmit={savePopups} className="space-y-4">
        {popups.map((popup, index) => <article key={popup.id} className="rounded-2xl border border-slate-200 p-4">
          <header className="mb-4 flex items-center justify-between gap-3"><div><b>پاپ‌آپ {index + 1}: {popup.title || "بدون عنوان"}</b><p className="mt-1 text-xs text-slate-500">{popup.productIds.length.toLocaleString("fa-IR")} محصول انتخاب شده</p></div><button type="button" onClick={() => setPopups((items) => items.filter((item) => item.id !== popup.id))} className="btn-ghost text-rose-700"><Trash2 className="size-4"/>حذف</button></header>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold md:col-span-2"><input type="checkbox" checked={popup.enabled} onChange={(event) => updatePopup(popup.id, { enabled: event.target.checked })} className="size-4 accent-emerald-600"/>فعال‌سازی این پاپ‌آپ</label>
            <label className="text-xs font-bold">عنوان<input maxLength={120} required value={popup.title} onChange={(event) => updatePopup(popup.id, { title: event.target.value })} className="input mt-1"/></label>
            <label className="text-xs font-bold">متن توضیح<textarea maxLength={600} value={popup.body} onChange={(event) => updatePopup(popup.id, { body: event.target.value })} className="input mt-1 min-h-20"/></label>
            <div className="md:col-span-2"><b className="mb-2 block text-xs">تصویر این پاپ‌آپ (اختیاری)</b><ImageUploader value={popup.imageId ? [popup.imageId] : []} max={1} folderSlug="custom" onChange={(ids) => updatePopup(popup.id, { imageId: ids[0] ?? 0 })}/></div>
            <div className="rounded-xl border p-3 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">محصولات مقصد</b><p className="mt-1 text-xs text-slate-500">کلیک روی دکمهٔ پاپ‌آپ، فقط همین محصولات را در فروشگاه نمایش می‌دهد.</p></div><button type="button" className="btn-sm" onClick={() => { setPickerId(popup.id); setResults([]); setQuery(""); }}><Search className="size-3.5"/>انتخاب محصول ({popup.productIds.length})</button></div>
              {!!popup.productIds.length && <div className="mt-3 flex flex-wrap gap-2">{(productChoices[popup.id] ?? []).map((product) => <span key={product.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs text-emerald-950"><span className="truncate">{product.name}</span><button type="button" aria-label={`حذف ${product.name}`} onClick={() => toggleProduct(product)} className="rounded-full p-0.5 hover:bg-emerald-100"><X className="size-3.5"/></button></span>)}</div>}
            </div>
            <label className="text-xs font-bold">متن دکمه<input maxLength={60} value={popup.buttonLabel} onChange={(event) => updatePopup(popup.id, { buttonLabel: event.target.value })} className="input mt-1"/></label>
            <label className="text-xs font-bold">تأخیر نمایش (ثانیه)<input type="number" min={0} max={120} value={popup.delaySeconds} onChange={(event) => updatePopup(popup.id, { delaySeconds: Number(event.target.value) })} className="input mt-1"/></label>
            <label className="text-xs font-bold">تکرار نمایش همین پاپ‌آپ (ساعت)<input type="number" min={1} max={720} value={popup.repeatHours} onChange={(event) => updatePopup(popup.id, { repeatHours: Number(event.target.value) })} className="input mt-1"/></label>
          </div>
        </article>)}
        {popups.length > 0 && <button disabled={popupBusy} className="btn-primary w-full">{popupBusy ? "در حال ذخیره…" : "ذخیره همه پاپ‌آپ‌ها"}</button>}
      </form>
    </section>

    {pickerId && <Modal title="انتخاب محصولات پیشنهاد ویژه" onClose={() => setPickerId(null)} wide>
      <div className="flex flex-col gap-3 sm:flex-row"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKey} className="input min-w-0 flex-1" placeholder="نام محصول، SKU یا کد محصول"/><button type="button" onClick={() => void searchProducts()} disabled={searchBusy} className="btn-primary shrink-0">{searchBusy ? "جستجو…" : "جستجو"}</button></div>
      <p className="my-3 text-xs text-slate-500">انتخاب‌شده برای این پاپ‌آپ: {(popups.find((item) => item.id === pickerId)?.productIds.length ?? 0).toLocaleString("fa-IR")} محصول</p>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border">{results.map((product) => { const checked = popups.find((item) => item.id === pickerId)?.productIds.includes(product.id) ?? false; return <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b p-3 text-sm last:border-0 hover:bg-slate-50"><input type="checkbox" checked={checked} onChange={() => toggleProduct(product)} className="size-4 accent-amber-500"/>{product.imageId ? <img src={`/api/media/${product.imageId}`} alt="" className="size-11 rounded-lg object-cover"/> : <span className="size-11 rounded-lg bg-slate-100"/>}<span className="min-w-0 flex-1"><b className="block truncate">{product.name}</b><small className="text-slate-500" dir="ltr">{product.sku}</small></span>{checked && <Check className="size-4 text-emerald-700"/>}</label>; })}{!results.length && <p className="p-8 text-center text-sm text-slate-500">نام یا کد محصول را جست‌وجو کنید.</p>}</div>
      <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={() => setPickerId(null)}>تأیید انتخاب‌ها</button></div>
    </Modal>}
  </div>;
}
