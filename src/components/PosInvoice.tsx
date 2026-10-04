"use client";
import { useEffect } from "react";
import { jdate, toman } from "@/lib/util";
import { fillLabel } from "./LabelView";

type Line = { title: string; quantity: number; unitPrice: number; lineTotal: number };
type Design = { invoiceWidth: number; invoiceFontSize: number; invoiceBorderStyle: string; invoiceHeaderTemplate: string };
export function PosInvoice({ sale, items, shop, autoPrint = false, embedded = false, terminal, labelHref, design }: {
  sale: { number: string; customerName: string; customerPhone: string; shippingCity?: string | null; shippingAddress?: string | null; shippingPostalCode?: string | null; shippingCarrierName?: string | null; shippingFreightCollect?: boolean; shippingCost?: number; subtotal: number; discount: number; total: number; paymentMethod: string; settlement: { cash: number; card: number }; createdAt: Date };
  items: Line[]; shop: string; autoPrint?: boolean; embedded?: boolean; terminal?: string; labelHref?: string; design?: Design;
}) {
  useEffect(() => { if (autoPrint) { const t = window.setTimeout(() => window.print(), 350); return () => window.clearTimeout(t); } }, [autoPrint]);
  const headerText = design ? fillLabel(design.invoiceHeaderTemplate, { siteName: shop, invoiceNumber: sale.number, date: jdate(sale.createdAt, true) }) : "";
  const border = design?.invoiceBorderStyle === "none" ? "none" : design?.invoiceBorderStyle === "dashed" ? "2px dashed #64748b" : "1px solid #94a3b8";
  return <main dir="rtl" className="mx-auto bg-white p-6 text-stone-900 shadow print:max-w-none print:p-2" style={{ maxWidth: design ? `${design.invoiceWidth}mm` : "36rem", fontSize: design ? `${design.invoiceFontSize}px` : undefined, border }}>
    {design && <div className="mb-4 whitespace-pre-line border-b-2 border-black pb-3 text-center font-bold">{headerText}</div>}
    <div className="mb-5 flex items-start justify-between border-b pb-4"><div><h1 className="text-2xl font-black">{shop}</h1><p className="mt-1 text-sm">فاکتور فروش حضوری</p></div><div className="text-left text-sm"><b dir="ltr">{sale.number}</b><p className="mt-1">{jdate(sale.createdAt, true)}</p></div></div>
    <div className="mb-4 flex justify-between text-sm"><span>{sale.customerName}</span><span dir="ltr">{sale.customerPhone}</span></div>
    {sale.shippingAddress && <div className="mb-4 rounded-lg border p-3 text-sm"><b>نشانی گیرنده</b><p className="mt-1">{sale.shippingCity} — {sale.shippingAddress}</p><p className="mt-1">کد پستی: <span dir="ltr">{sale.shippingPostalCode}</span></p></div>}
    <table className="w-full text-right text-sm"><thead><tr className="border-y"><th className="py-2">شرح کالا</th><th>تعداد</th><th>قیمت</th><th>جمع</th></tr></thead><tbody>{items.map((x, i) => <tr key={i} className="border-b"><td className="py-2">{x.title}</td><td>{x.quantity.toLocaleString("fa-IR")}</td><td>{toman(x.unitPrice)}</td><td>{toman(x.lineTotal)}</td></tr>)}</tbody></table>
    <div className="mt-4 space-y-2 text-sm"><p className="flex justify-between"><span>جمع کالاها</span><b>{toman(sale.subtotal)}</b></p><p className="flex justify-between"><span>تخفیف</span><b>{toman(sale.discount)}</b></p>{sale.shippingFreightCollect ? <p className="flex justify-between rounded bg-amber-50 p-2 font-bold text-amber-900"><span>ارسال پس‌کرایه {sale.shippingCarrierName ? `(${sale.shippingCarrierName})` : ""}</span><b>پرداخت هزینه به شرکت پستی هنگام تحویل</b></p> : sale.shippingCost !== undefined && sale.shippingCost > 0 && <p className="flex justify-between"><span>هزینه ارسال {sale.shippingCarrierName ? `(${sale.shippingCarrierName})` : ""}</span><b>{toman(sale.shippingCost)}</b></p>}<p className="flex justify-between border-t pt-2 text-base"><span>مبلغ نهایی</span><b>{toman(sale.total)}</b></p><p className="flex justify-between text-xs text-stone-600"><span>نقدی / کارت</span><span>{toman(sale.settlement.cash)} / {toman(sale.settlement.card)}</span></p></div>
    <p className="mt-8 border-t pt-3 text-center text-xs">از خرید محصولات ارگانیک سپاسگزاریم 🌱</p>{terminal && <p className="mt-3 text-xs">کارتخوان: {terminal}</p>}
    <div className="mt-5 flex flex-col gap-2 print:hidden">{!embedded && <button className="btn-primary w-full" onClick={() => window.print()}>چاپ فاکتور (Enter)</button>}{labelHref && <a className="btn-ghost w-full" href={labelHref} target="_blank" rel="noreferrer">چاپ لیبل پستی گیرنده</a>}</div>
  </main>;
}
