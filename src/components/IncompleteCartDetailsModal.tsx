"use client";

import { useState } from "react";
import { Eye, MessageSquareText, Package } from "lucide-react";
import { Modal } from "@/components/Modal";
import { faNum, jdate } from "@/lib/util";

type CartItem = { productId: number; variantId?: number | null; offerId?: number | null; qty: number; title?: string };
type IncompleteCart = {
  id: number; customerName: string | null; phone: string | null; items: CartItem[] | unknown;
  reason: string; status: string; lastSmsStatus: string | null; lastSmsType: string | null;
  lastSmsAt: Date | string | null; createdAt: Date | string; updatedAt: Date | string;
  discountCodeId: number | null;
};

const statusLabel: Record<string, string> = { checkout_started: "پرداخت آغاز شده", abandoned: "سبد رهاشده", completed: "تکمیل‌شده" };
const smsLabel: Record<string, string> = { sent: "ارسال شد", simulated: "شبیه‌سازی شد", partial: "ارسال بخشی موفق بود", failed: "ناموفق" };

export function IncompleteCartDetailsButton({ cart }: { cart: IncompleteCart }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(cart.items) ? cart.items as CartItem[] : [];
  return <>
    <button type="button" className="btn-sm" onClick={() => setOpen(true)}><Eye className="size-3.5"/>جزئیات</button>
    {open && <Modal title="جزئیات سبد ناقص" onClose={() => setOpen(false)} wide>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="مشتری" value={cart.customerName || "مشتری"}/>
          <Info label="شماره همراه" value={cart.phone || "ثبت نشده"} ltr/>
          <Info label="وضعیت" value={statusLabel[cart.status] ?? cart.status}/>
          <Info label="آخرین فعالیت" value={jdate(cart.updatedAt, true)}/>
          <Info label="زمان ایجاد" value={jdate(cart.createdAt, true)}/>
          <Info label="دلیل ناقص ماندن" value={cart.reason || "ثبت نشده"}/>
          {cart.discountCodeId && <Info label="کد تخفیف مرتبط" value={`#${faNum(cart.discountCodeId)}`}/ >}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold"><Package className="size-4 text-amber-600"/>اقلام سبد ({faNum(items.length)})</h3>
          {items.length ? <div className="space-y-2">{items.map((item, index) => <div key={`${item.productId}-${item.variantId ?? 0}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{item.title || `محصول ${faNum(item.productId)}`}</b><span className="text-slate-600">تعداد: {faNum(item.qty)}{item.variantId ? ` · تنوع ${faNum(item.variantId)}` : ""}</span></div>)}</div> : <p className="text-sm text-slate-500">اقلام سبد در دسترس نیست.</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 flex items-center gap-2 font-extrabold"><MessageSquareText className="size-4 text-amber-600"/>پیگیری پیامکی</h3>
          <div className="grid gap-3 text-sm sm:grid-cols-3"><Info label="آخرین وضعیت" value={cart.lastSmsStatus ? smsLabel[cart.lastSmsStatus] ?? cart.lastSmsStatus : "پیامکی ثبت نشده"}/>{cart.lastSmsType && <Info label="نوع پیام" value={cart.lastSmsType}/ >}{cart.lastSmsAt && <Info label="زمان ارسال" value={jdate(cart.lastSmsAt, true)}/>}</div>
        </section>
      </div>
    </Modal>}
  </>;
}

function Info({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><span className="block text-[11px] text-slate-500">{label}</span><b className="mt-1 block break-words text-sm" dir={ltr ? "ltr" : undefined}>{value}</b></div>;
}
