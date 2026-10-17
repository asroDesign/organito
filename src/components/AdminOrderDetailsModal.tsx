"use client";
import { useState } from "react";
import { Eye, Loader2, MapPin, Package, ReceiptText } from "lucide-react";
import { api } from "./client";
import { Modal } from "./Modal";
import { faNum, jdate, toman } from "@/lib/util";

type OrderKind = "online" | "central" | "seller";
type Line = { title: string; quantity: number; unitPrice: number | null; lineTotal: number | null };
type Detail = {
  kind: OrderKind;
  order: {
    id: number; number: string; status: string; paymentStatus: string; total: number | null;
    itemsSubtotal?: number | null; sellerShippingTotal?: number | null; centralShipping?: number | null;
    shippingCost?: number | null; discount?: number | null; tax?: number | null; createdAt: string;
    address?: { fullName?: string; phone?: string; city?: string; address?: string; postalCode?: string };
    shippingCity?: string | null; shippingAddress?: string | null; shippingPostalCode?: string | null;
    shippingCarrierName?: string | null; shippingFreightCollect?: boolean; shippingTrackingNumber?: string | null;
    fulfillmentType?: string; pickupCenterName?: string | null; discountCode?: string | null;
    paymentMethod?: string; settlement?: { cash: number; card: number }; shopName?: string;
  };
  customer: { name: string; phone: string } | null;
  items: Line[];
  payments: { method: string; status: string; amount: number | null; refCode: string | null; gateway: string | null; paidAt: string | null; trackingCode: string | null }[];
};

const statusLabel: Record<string, string> = { pending_payment: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال پردازش", shipped: "ارسال‌شده", completed: "تکمیل‌شده", cancelled: "لغوشده", returned: "مرجوع‌شده", unpaid: "پرداخت‌نشده", refunded: "مسترد", pending_verification: "در انتظار تأیید" };
const methodLabel: Record<string, string> = { online: "پرداخت آنلاین", gateway: "درگاه پرداخت", cash: "نقدی", card: "کارت‌خوان", mixed: "نقد و کارت‌خوان", transfer: "حواله بانکی", wallet: "کیف پول" };

export function AdminOrderDetailsButton({ kind, id }: { kind: OrderKind; id: number }) {
  const [open, setOpen] = useState(false), [detail, setDetail] = useState<Detail | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const show = async () => {
    setOpen(true); setError("");
    if (detail) return;
    setBusy(true);
    try { setDetail(await api<Detail>(`/api/admin/order-details/${kind}/${id}`, "GET")); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const order = detail?.order;
  const address = order?.address;
  const hasAddress = !!(address?.address || order?.shippingAddress);
  return <>
    <button type="button" className="btn-sm" onClick={() => void show()}><Eye className="size-3.5"/>جزئیات</button>
    {open && <Modal title="جزئیات سفارش و فاکتور" onClose={() => setOpen(false)} wide>
      {busy ? <div className="grid min-h-48 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><Loader2 className="size-5 animate-spin"/>در حال دریافت جزئیات…</span></div>
        : error ? <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        : detail && order ? <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="شماره فاکتور" value={order.number} ltr/>
            <Info label="تاریخ ثبت" value={jdate(order.createdAt, true)}/>
            <Info label="وضعیت سفارش" value={statusLabel[order.status] ?? order.status}/>
            <Info label="وضعیت پرداخت" value={statusLabel[order.paymentStatus] ?? order.paymentStatus}/>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 font-extrabold"><ReceiptText className="size-4 text-amber-600"/>مشتری و فروش</h3>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Info label="نام مشتری" value={detail.customer?.name ?? "—"}/><Info label="شماره همراه" value={detail.customer?.phone ?? "—"} ltr/>{order.shopName && <Info label="فروشگاه" value={order.shopName}/>}</div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 font-extrabold"><Package className="size-4 text-amber-600"/>اقلام سفارش ({faNum(detail.items.length)})</h3>
            {detail.items.length ? <div className="space-y-2">{detail.items.map((item, i) => <div key={`${item.title}-${i}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><b className="text-sm leading-6">{item.title}</b><span className="text-xs text-slate-500">{toman(item.unitPrice ?? 0)} × {faNum(item.quantity)}</span><b className="text-sm text-emerald-800">{toman(item.lineTotal ?? 0)}</b></div>)}</div> : <p className="text-sm text-slate-500">اقلامی برای این فاکتور ثبت نشده است.</p>}
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-extrabold">خلاصه مالی</h3><div className="space-y-2 text-sm"><KV label="جمع اقلام" value={toman(order.itemsSubtotal ?? 0)}/>{order.discount ? <KV label="تخفیف" value={`− ${toman(order.discount)}`}/>:null}{order.tax ? <KV label="مالیات" value={toman(order.tax)}/>:null}{order.sellerShippingTotal !== undefined && <KV label="ارسال فروشندگان" value={toman(order.sellerShippingTotal ?? 0)}/ >}{order.centralShipping !== undefined && <KV label="ارسال انبار مرکزی" value={toman(order.centralShipping ?? 0)}/ >}{order.shippingCost !== undefined && <KV label="هزینه ارسال" value={order.shippingFreightCollect ? "پس‌کرایه" : toman(order.shippingCost ?? 0)}/>}<KV label="مبلغ نهایی" value={toman(order.total ?? 0)} strong/>{order.discountCode && <KV label="کد تخفیف" value={order.discountCode}/>}</div></section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-extrabold">روش و سوابق پرداخت</h3><p className="mb-3 text-sm">روش پرداخت: <b>{methodLabel[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "ثبت نشده"}</b></p>{order.settlement && <div className="mb-3 grid grid-cols-2 gap-2 text-xs"><Info label="نقد" value={toman(order.settlement.cash)}/><Info label="کارت‌خوان" value={toman(order.settlement.card)}/></div>}{detail.payments.length ? <div className="space-y-2">{detail.payments.map((payment,i)=><div key={i} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><b>{methodLabel[payment.method]??payment.method} · {statusLabel[payment.status]??payment.status}</b><b>{toman(payment.amount??0)}</b></div>{(payment.gateway||payment.refCode||payment.trackingCode)&&<p className="mt-2 break-all text-slate-500">{payment.gateway&&`درگاه: ${payment.gateway} · `}{payment.refCode&&`مرجع: ${payment.refCode} · `}{payment.trackingCode&&`پیگیری: ${payment.trackingCode}`}</p>}{payment.paidAt&&<p className="mt-1 text-slate-500">{jdate(payment.paidAt,true)}</p>}</div>)}</div>:<p className="text-xs text-slate-500">برای این فاکتور سابقهٔ پرداخت آنلاین ثبت نشده است.</p>}</section>
          </div>
          {hasAddress && <section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 flex items-center gap-2 font-extrabold"><MapPin className="size-4 text-emerald-700"/>اطلاعات ارسال</h3><div className="grid gap-3 text-sm sm:grid-cols-2">{(address?.fullName||order.shippingAddress)&&<Info label="تحویل‌گیرنده / نشانی" value={[address?.fullName,order.shippingAddress??address?.address].filter(Boolean).join(" · ")}/ >}<Info label="شهر" value={order.shippingCity??address?.city??"—"}/><Info label="کد پستی" value={order.shippingPostalCode??address?.postalCode??"—"} ltr/>{order.shippingCarrierName&&<Info label="شرکت پستی" value={`${order.shippingCarrierName}${order.shippingFreightCollect?" · پس‌کرایه":""}`}/ >}{order.shippingTrackingNumber&&<Info label="کد رهگیری" value={order.shippingTrackingNumber} ltr/>}</div></section>}
        </div> : null}
    </Modal>}
  </>;
}

function Info({label,value,ltr=false}:{label:string;value:string|number;ltr?:boolean}) { return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><span className="block text-[11px] text-slate-500">{label}</span><b className={`mt-1 block break-words text-sm ${ltr?"text-left": ""}`} dir={ltr?"ltr":undefined}>{value}</b></div>; }
function KV({label,value,strong=false}:{label:string;value:string;strong?:boolean}) { return <div className={`flex justify-between gap-3 ${strong?"border-t border-slate-200 pt-2 font-extrabold text-emerald-800":"text-slate-600"}`}><span>{label}</span><span>{value}</span></div>; }
