"use client";
import { ArrowDownToLine, ArrowUpFromLine, Package, X } from "lucide-react";
import type { InventoryChoice } from "./InventoryProductPicker";
import { InventoryReceiptForm } from "./InventoryReceiptForm";

type InventoryParty = { id: number; name: string };
export function InvClient({ product, parties, onChangeProduct }: { product: InventoryChoice; parties: InventoryParty[]; onChangeProduct: () => void }) {
  const { productId, variantId, name, sku, unit, variant, onHand, reserved } = product;
  const label = `${name}${variant ? ` · ${variant}` : ""}`;
  return <div className="overflow-hidden rounded-xl border border-slate-200">
    <div className="flex items-start justify-between gap-3 bg-slate-50 px-3.5 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Package className="size-4" /></span>
        <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{label}</p><p className="mt-0.5 text-xs text-slate-500" dir="ltr">{sku} · {unit}</p></div>
      </div>
      <button type="button" onClick={onChangeProduct} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"><X className="size-3.5" /> تغییر کالا</button>
    </div>

    <div className="space-y-3 p-3.5">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
        <p className="text-xs font-bold text-emerald-900">راهنمای ثبت مقدار</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] leading-5 text-slate-600">
          <div className="flex gap-1.5"><ArrowDownToLine className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /><span><b className="text-emerald-800">عدد مثبت:</b> ورود کالا و ثبت رسید خرید</span></div>
          <div className="flex gap-1.5"><ArrowUpFromLine className="mt-0.5 size-3.5 shrink-0 text-amber-600" /><span><b className="text-amber-800">عدد منفی:</b> خروج یا کسری موجودی</span></div>
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">موجودی کل: <b>{onHand.toLocaleString("fa-IR")} {unit}</b> · رزرو: <b>{reserved.toLocaleString("fa-IR")} {unit}</b>{product.consignmentOwners.length > 0 && <div className="mt-2 border-t pt-2 text-amber-900">امانی: {product.consignmentOwners.map((owner) => `${owner.name} (${owner.quantity.toLocaleString("fa-IR")} ${unit})`).join("، ")}</div>}</div>
      <InventoryReceiptForm productId={productId} variantId={variantId} unit={unit} parties={parties} />
    </div>
  </div>;
}
