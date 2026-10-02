"use client";

import { useState } from "react";
import { api, toast } from "./client";

export function PriceEditor({ productId, variantId, cost, price, sale }: { productId: number; variantId: number | null; cost: number; price: number; sale: number }) {
  const [values, setValues] = useState({ cost: String(cost || ""), price: String(price || ""), sale: String(sale || "") });
  const [busy, setBusy] = useState(false);
  return <form className="grid min-w-[470px] grid-cols-[repeat(3,minmax(105px,1fr))_auto] items-end gap-2" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api("/api/admin/product-prices", "POST", { productId, variantId, cost: Number(values.cost || 0), price: Number(values.price || 0), sale: Number(values.sale || 0) });
      toast("قیمت‌ها ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  }}>
    {(["cost", "price", "sale"] as const).map((key) => <label className="flex flex-col gap-1 text-[10px] text-slate-500" key={key}><span>{key === "cost" ? "هزینه خرید" : key === "price" ? "قیمت فروش" : "قبل از تخفیف"}</span><input className="input !h-9 !px-2 text-xs" type="number" min="0" step="1" value={values[key]} onChange={(e) => setValues((old) => ({ ...old, [key]: e.target.value }))} /></label>)}
    <button className="btn-primary !h-9 !px-3 text-xs" disabled={busy}>{busy ? "ذخیره…" : "ذخیره"}</button>
  </form>;
}
