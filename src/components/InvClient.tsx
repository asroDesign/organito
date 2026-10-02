"use client";
import { ArrowDownToLine, ArrowUpFromLine, Package, X } from "lucide-react";
import { JsonForm } from "./client";
import type { InventoryChoice } from "./InventoryProductPicker";

export function InvClient({ product, onChangeProduct }: { product: InventoryChoice; onChangeProduct: () => void }) {
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
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">موجودی: <b>{onHand.toLocaleString("fa-IR")} {unit}</b> · رزرو: <b>{reserved.toLocaleString("fa-IR")} {unit}</b></div>
      <JsonForm key={`${productId}:${variantId ?? 0}`} url={`/api/admin/inventory/${productId}`} extra={variantId ? { variantId } : undefined} submit="ثبت در گردش انبار" fields={[
        { name: "qty", label: `مقدار ورود / خروج (${unit})`, type: "number", required: true, placeholder: `مثلاً ۱۲ ${unit} یا ۳- ${unit}` },
        { name: "unitCost", label: "قیمت خرید هر واحد", type: "number", half: true, placeholder: "برای رسید خرید", defaultValue: 0 },
        { name: "freight", label: "هزینه حمل", type: "number", half: true, placeholder: "مبلغ کل", defaultValue: 0 },
        { name: "customs", label: "هزینه گمرک", type: "number", half: true, placeholder: "مبلغ کل", defaultValue: 0 },
        { name: "note", label: "توضیحات / شماره فاکتور", placeholder: "اختیاری؛ برای پیگیری گردش موجودی" },
      ]} />
    </div>
  </div>;
}
