import Link from "next/link";
import { loadOrderForPrint } from "@/lib/printAccess";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { Barcode } from "@/components/LabelView";
import { PaymentInfoBox } from "@/components/PaymentInfoBox";
import { ORDER_STATUS, SHIPMENT_STATUS, faNum, jdate } from "@/lib/util";

export const metadata = { title: "پرینت سفارش" };

export default async function OrderPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { o, shs, items, sellers, customer, pays, u, staffOk } = await loadOrderForPrint(id, "order");
  const s = await getSettings();
  const sellerView = !staffOk && !!u.sellerId && o.customerId !== u.id;
  const back = staffOk ? `/orders/${o.id}` : sellerView ? `/seller/orders/${o.id}` : `/customer/orders/${o.id}`;
  const cell = "border border-slate-400 p-1.5";
  let row = 0;
  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-4 flex flex-wrap justify-between gap-2 px-2">
        <Link href={back} className="btn-ghost">بازگشت به سفارش</Link>
        <div className="flex gap-2">{(staffOk || sellerView) && <Link href={`/print/order-labels/${o.id}`} className="btn-ghost">🏷️ لیبل‌های پستی</Link>}<PrintButton label="چاپ سفارش" /></div>
      </div>
      <div className="invoice-sheet bg-white p-8 text-[12.5px] leading-7 text-black shadow print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div><div className="text-2xl font-black">{s.siteName}</div><div className="text-xs">{s.siteTagline}</div><div className="text-[11px]">{s.senderCity} - {s.senderAddress} · تلفن {s.senderPhone}</div></div>
          <div className="text-center"><div className="text-xl font-black">{o.officialInvoiceType ? "صورتحساب رسمی" : "برگه سفارش"}</div><div className="text-xs">وضعیت: {ORDER_STATUS[o.status]}</div></div>
          <div className="w-44 text-left text-xs"><div>شماره سفارش: <b dir="ltr">{o.number}</b></div><div>تاریخ ثبت: <b>{jdate(o.createdAt, true)}</b></div><div className="mt-1"><Barcode value={o.number} height={30} /></div></div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-400 p-3"><b className="block border-b border-slate-300 pb-1">فرستنده</b><div>{s.senderName}</div><div>{s.senderCity} - {s.senderAddress}</div><div>تلفن: {s.senderPhone} · کد پستی: {s.senderPostalCode}</div><div className="text-xs">کد اقتصادی: {s.economicCode}</div></div>
          <div className="rounded-lg border border-slate-400 p-3"><b className="block border-b border-slate-300 pb-1">گیرنده</b><div>{o.address.fullName} {customer && !sellerView ? `(${customer.name})` : ""}</div><div>تلفن: <span dir="ltr">{o.address.phone}</span></div><div>{o.address.city} — {o.address.address}</div><div>کد پستی: {o.address.postalCode || "—"}</div></div>
          {!sellerView && o.officialInvoiceType && o.officialInvoiceDetails && <div className="col-span-2 rounded-lg border-2 border-emerald-700 p-3"><b className="block border-b border-slate-300 pb-1">مشخصات صورتحساب رسمی · {o.officialInvoiceType === "company" ? "شخص حقوقی" : "شخص حقیقی"}</b>{o.officialInvoiceType === "company" ? <><div>نام شرکت: {o.officialInvoiceDetails.companyName}</div><div>شناسه ملی: <span dir="ltr">{o.officialInvoiceDetails.companyNationalId}</span></div><div>مدیرعامل: {o.officialInvoiceDetails.managerName}</div></> : <><div>نام: {o.officialInvoiceDetails.name}</div><div>کد ملی: <span dir="ltr">{o.officialInvoiceDetails.nationalId}</span></div></>}</div>}
        </section>
        <table className="mt-4 w-full border-collapse text-center text-[12px]">
          <thead><tr className="bg-slate-100">{["ردیف", "شرح کالا", "فروشنده / مرسوله", "تعداد", "فی (تومان)", "مبلغ"].map((h) => <th key={h} className={cell}>{h}</th>)}</tr></thead>
          <tbody>
            {shs.map((sh) => {
              const seller = sellers.find((x) => x.id === sh.sellerId);
              return items.filter((i) => i.shipmentId === sh.id).map((i) => (
                <tr key={i.id}><td className={cell}>{faNum(++row)}</td><td className={`${cell} text-right`}>{i.title}</td><td className={`${cell} text-[11px]`}>{seller?.shopName ?? "انبار مرکزی"} · #{faNum(sh.id)}<div className="text-slate-500">{sh.sellerId ? "فاکتور نیابتی" : "فاکتور فروش"}</div></td><td className={cell}>{faNum(i.qty)}</td><td className={cell}>{faNum(i.unitPrice)}</td><td className={cell}>{faNum(i.lineTotal)}</td></tr>
              ));
            })}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="rounded-lg border border-slate-400 p-3 text-xs"><b className="mb-1 block border-b border-slate-300 pb-1">مرسوله‌ها</b>
              {shs.map((sh) => <div key={sh.id} className="flex justify-between gap-2"><span>#{faNum(sh.id)} {sellers.find((x) => x.id === sh.sellerId)?.shopName ?? "انبار مرکزی"} — {SHIPMENT_STATUS[sh.status]}</span><span>{sh.carrier ?? "—"} <span dir="ltr">{sh.trackingNumber ?? ""}</span></span></div>)}
            </div>
            {!sellerView && <PaymentInfoBox pays={pays} compact />}
          </div>
          {!sellerView ? (
            <table className="h-fit w-full border-collapse text-[12px]"><tbody>
              {[["جمع اقلام", o.itemsSubtotal], ["ارسال فروشندگان", o.sellerShippingTotal], ["ارسال انبار مرکزی", o.centralShipping], ...(o.festivalDiscount ? [["تخفیف جشنواره", -o.festivalDiscount]] : []), ...(o.codeDiscount ? [[`کد تخفیف ${o.discountCode ?? ""}`, -o.codeDiscount]] : []), [`مالیات (${faNum(s.taxRate)}٪)`, o.tax]].map(([k, v]) => <tr key={k as string}><td className={cell}>{k}</td><td className={`${cell} text-left`}>{faNum(v as number)}</td></tr>)}
              <tr className="bg-slate-100 font-black"><td className={cell}>مبلغ قابل پرداخت</td><td className={`${cell} text-left`}>{faNum(o.total)} تومان</td></tr>
            </tbody></table>
          ) : <div className="rounded-lg border border-slate-400 p-3 text-xs">این برگه فقط اقلام متعلق به فروشگاه شما را نمایش می‌دهد.</div>}
        </div>
        <p className="mt-4 text-xs text-slate-600">{s.invoiceFooter}</p>
        <footer className="mt-10 grid grid-cols-3 gap-8 text-center text-xs"><div className="border-t border-slate-400 pt-2">جمع‌آوری و بسته‌بندی</div><div className="border-t border-slate-400 pt-2">کنترل کیفیت</div><div className="border-t border-slate-400 pt-2">امضای تحویل‌گیرنده</div></footer>
      </div>
    </div>
  );
}
