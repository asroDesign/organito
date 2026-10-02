"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, PackageSearch, Search, X } from "lucide-react";
import { InvClient } from "./InvClient";

export type InventoryChoice = { productId: number; variantId: number | null; name: string; variant: string | null; sku: string; unit: string; baseUnit: string; baseUnitAmount: number; onHand: number; reserved: number; unitCost: number; lowStockThreshold: number };

const normalize = (value: string) => value
  .toLocaleLowerCase("fa")
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .trim();

export function InventoryProductPicker({ items }: { items: InventoryChoice[] }) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [open, setOpen] = useState(false);
  const getKey = (item: InventoryChoice) => `${item.productId}:${item.variantId ?? 0}`;
  const selected = items.find((item) => getKey(item) === selectedKey);
  const filtered = useMemo(() => {
    const q = normalize(query);
    return items.filter((item) => !q || normalize(`${item.name} ${item.variant ?? ""} ${item.sku}`).includes(q));
  }, [items, query]);

  function choose(item: InventoryChoice) {
    setSelectedKey(getKey(item));
    setQuery("");
    setOpen(false);
  }

  return <div className="space-y-4">
    <div className="relative">
      <label htmlFor="inventory-product-search" className="mb-1.5 block text-sm font-semibold text-slate-700">جست‌وجو و انتخاب کالا</label>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id="inventory-product-search"
          className="input h-11 pr-10 pl-10"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && filtered[0]) { e.preventDefault(); choose(filtered[0]); }
          }}
          placeholder="نام کالا یا کد محصول را وارد کنید"
          role="combobox"
          aria-expanded={open}
          aria-controls="inventory-product-results"
          autoComplete="off"
        />
        {query && <button type="button" onClick={() => { setQuery(""); setOpen(true); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="پاک کردن جست‌وجو"><X className="size-4" /></button>}
      </div>
      {open && <>
        <button aria-label="بستن نتایج جست‌وجو" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
        <div id="inventory-product-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {filtered.length ? filtered.slice(0, 100).map((item) => {
            const key = getKey(item);
            return <button type="button" role="option" aria-selected={key === selectedKey} key={key} onClick={() => choose(item)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-right transition hover:bg-emerald-50 ${key === selectedKey ? "bg-emerald-50 text-emerald-800" : "text-slate-700"}`}>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.name}{item.variant ? ` · ${item.variant}` : ""}</span><span className="mt-0.5 block text-xs text-slate-400" dir="ltr">{item.sku} · {item.unit}</span></span>
              {key === selectedKey && <Check className="size-4 shrink-0 text-emerald-600" />}
            </button>;
          }) : <div className="px-3 py-7 text-center text-sm text-slate-500"><PackageSearch className="mx-auto mb-2 size-5 text-slate-300" />کالایی با این عبارت پیدا نشد.</div>}
          {filtered.length > 100 && <p className="border-t px-3 py-2 text-center text-xs text-slate-400">برای دیدن نتایج بیشتر، جست‌وجو را دقیق‌تر کنید.</p>}
        </div>
      </>}
      <p className="mt-1.5 text-xs text-slate-400">{items.length.toLocaleString("fa-IR")} کالا در انبار · جست‌وجو با نام یا کد کالا</p>
    </div>

    {selected ? <InvClient key={selectedKey} product={selected} onChangeProduct={() => setSelectedKey("")} /> : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500"><PackageSearch className="mx-auto mb-2 size-6 text-slate-300" />برای ثبت رسید یا تعدیل، ابتدا کالا و تنوع آن را انتخاب کنید.<button type="button" onClick={() => setOpen(true)} className="mt-2 flex items-center justify-center gap-1 mx-auto text-xs font-semibold text-emerald-700">نمایش کالاها <ChevronDown className="size-3" /></button></div>}
  </div>;
}
