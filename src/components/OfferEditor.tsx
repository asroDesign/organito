"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { JsonForm } from "./client";

type Init = { price: number; costPrice: number; salePrice: number | null; stock: number; shippingCost: number; prepDays: number; warranty: string | null; shipCity: string | null };
export function OfferEditor({ productId, initial, label }: { productId: number; initial?: Init; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-sm" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-between"><b>{label}</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <p className="mb-3 text-xs text-amber-700">تغییر بیش از ۲۰٪ قیمت یا وضعیت کالا نیازمند تأیید مجدد مدیر است.</p>
            <JsonForm url="/api/seller/offers" extra={{ productId }} submit="ذخیره پیشنهاد" onDone={() => setOpen(false)} fields={[
              { name: "price", label: "قیمت فروش (تومان)", type: "number", required: true, half: true, defaultValue: initial?.price },
              { name: "costPrice", label: "قیمت خرید / تمام‌شده", type: "number", required: true, half: true, defaultValue: initial?.costPrice },
              { name: "salePrice", label: "قیمت تخفیف‌خورده", type: "number", half: true, defaultValue: initial?.salePrice ?? "" },
              { name: "stock", label: "موجودی", type: "number", required: true, half: true, defaultValue: initial?.stock ?? 0 },
              { name: "shippingCost", label: "هزینه ارسال مستقل", type: "number", half: true, defaultValue: initial?.shippingCost ?? 0 },
              { name: "prepDays", label: "زمان آماده‌سازی (روز)", type: "number", half: true, defaultValue: initial?.prepDays ?? 1 },
              { name: "shipCity", label: "شهر ارسال", half: true, defaultValue: initial?.shipCity ?? "" },
              { name: "condition", label: "وضعیت کالا", type: "select", half: true, options: [["new", "نو"], ["used", "کارکرده"], ["refurbished", "بازسازی‌شده"]] },
              { name: "warranty", label: "شرایط ضمانت", half: true, defaultValue: initial?.warranty ?? "" },
            ]} />
          </div>
        </div>
      )}
    </>
  );
}
