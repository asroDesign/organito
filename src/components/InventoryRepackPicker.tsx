"use client";
import { useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { InventoryRepackForm } from "./InventoryRepackForm";

type RepackProduct = { productId: number; name: string; baseUnit: string; variants: { id: number; title: string; sku: string; inventoryUnit: string; baseUnitAmount: number; onHand: number; reserved: number }[] };
export function InventoryRepackPicker({ products }: { products: RepackProduct[] }) {
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const matches = useMemo(() => products.filter((p) => `${p.name} ${p.variants.map((v) => `${v.title} ${v.sku}`).join(" ")}`.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa"))).slice(0, 8), [products, query]);
  const selected = products.find((p) => p.productId === productId);
  if (!products.length) return <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">برای بسته‌بندی، ابتدا محصولی با حداقل دو تنوع انبار تعریف کنید.</p>;
  return <div className="space-y-3">
    <label className="relative block"><span className="mb-1.5 block text-sm font-semibold">جست‌وجوی محصول برای بسته‌بندی</span><Search className="absolute right-3 top-10 size-4 text-slate-400" /><input className="input pr-9" value={query} onChange={(e) => { setQuery(e.target.value); setProductId(null); }} placeholder="نام محصول یا SKU یکی از تنوع‌ها" /></label>
    {!selected && <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-1.5">{matches.length ? matches.map((p) => <button type="button" key={p.productId} onClick={() => { setProductId(p.productId); setQuery(p.name); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right hover:bg-amber-50"><span className="font-semibold text-sm">{p.name}</span><span className="text-xs text-slate-400">{p.variants.length} تنوع</span></button>) : <p className="py-5 text-center text-xs text-slate-400">محصولی پیدا نشد.</p>}</div>}
    {selected && <><div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950"><PackageSearch className="size-4 shrink-0" />{selected.name}<button type="button" className="mr-auto font-semibold underline" onClick={() => setProductId(null)}>تغییر</button></div><InventoryRepackForm productId={selected.productId} productName={selected.name} baseUnit={selected.baseUnit} variants={selected.variants} /></>}
  </div>;
}
