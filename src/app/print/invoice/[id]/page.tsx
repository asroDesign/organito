import Link from "next/link";
import { loadShipmentForPrint } from "@/lib/printAccess";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { PaymentInfoBox } from "@/components/PaymentInfoBox";
import { Barcode } from "@/components/LabelView";
import { faNum, jdate } from "@/lib/util";

export const metadata = { title: "فاکتور" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sh, o, items, seller, customer, u, pays } = await loadShipmentForPrint(id, "invoice");
  const s = await getSettings();
  const agency = !!sh.sellerId;
  const tax = (n: number) => Math.round((n * s.taxRate) / 100);
  const itemsTotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const taxTotal = items.reduce((a, i) => a + tax(i.lineTotal), 0);
  const grand = itemsTotal + taxTotal + sh.shippingCost;
  const back = u.staff ? `/orders/${o.id}` : u.sellerId ? `/seller/orders/${o.id}` : `/customer/orders/${o.id}`;
  const box = "rounded-lg border border-slate-400 p-3";
  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-4 flex justify-between px-2"><Link href={back} className="btn-ghost">بازگشت به سفارش</Link><PrintButton label="چاپ فاکتور" /></div>
      <div className="invoice-sheet bg-white p-8 text-[13px] leading-7 text-black shadow print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-black pb-3">
          <div><div className="text-2xl font-black">{s.siteName}</div><div className="text-xs">{s.siteTagline}</div></div>
          <div className="text-center">
            <div className="text-xl font-black">{agency ? "فاکتور فروش نیابتی (حق‌العمل‌کاری)" : "صورتحساب فروش کالا"}</div>
            <div className="text-xs">{agency ? "صادرشده به نیابت از فروشنده توسط مارکت‌پلیس" : "فروشنده: انبار مرکزی"}</div>
          </div>
          <div className="text-left text-xs">
            <div>شماره: <b dir="ltr">INV-{o.number}-{sh.id}</b></div><div>تاریخ: <b>{jdate(o.createdAt)}</b></div><div>سفارش: <b dir="ltr">{o.number}</b></div>
            <div className="mt-1 w-40"><Barcode value={`${o.number}-${sh.id}`} height={28} /></div>
          </div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className={box}>
            <b className="block border-b border-slate-300 pb-1">مشخصات فروشنده</b>
            {agency ? <>
              <div>نام فروشگاه: {seller?.shopName}</div><div>شناسه ملی/کد ملی: {seller?.nationalId ?? "—"}</div><div>شهر: {seller?.city}</div>
              <div className="mt-1 text-xs">حق‌العمل‌کار (واسط): {s.siteName} — کد اقتصادی {s.economicCode}</div>
            </> : <><div>{s.siteName} — {s.senderName}</div><div>کد اقتصادی: {s.economicCode}</div><div>نشانی: {s.senderAddress}</div></>}
          </div>
          <div className={box}>
            <b className="block border-b border-slate-300 pb-1">مشخصات خریدار</b>
            <div>نام: {o.address.fullName} ({customer?.name})</div><div>تلفن: <span dir="ltr">{o.address.phone}</span></div>
            <div>نشانی: {o.address.city} — {o.address.address}</div><div>کد پستی: {o.address.postalCode || "—"}</div>
          </div>
        </section>
        <table className="mt-4 w-full border-collapse text-center text-[12px]">
          <thead><tr className="bg-slate-100">{["ردیف", "شرح کالا", "تعداد", "مبلغ واحد (تومان)", "مبلغ کل", `مالیات ${faNum(s.taxRate)}٪`, "جمع با مالیات"].map((h) => <th key={h} className="border border-slate-400 p-1.5">{h}</th>)}</tr></thead>
          <tbody>
            {items.map((i, k) => <tr key={i.id}><td className="border border-slate-400 p-1.5">{faNum(k + 1)}</td><td className="border border-slate-400 p-1.5 text-right">{i.title}</td><td className="border border-slate-400 p-1.5">{faNum(i.qty)}</td><td className="border border-slate-400 p-1.5">{faNum(i.unitPrice)}</td><td className="border border-slate-400 p-1.5">{faNum(i.lineTotal)}</td><td className="border border-slate-400 p-1.5">{faNum(tax(i.lineTotal))}</td><td className="border border-slate-400 p-1.5">{faNum(i.lineTotal + tax(i.lineTotal))}</td></tr>)}
            <tr><td className="border border-slate-400 p-1.5" /><td className="border border-slate-400 p-1.5 text-right">هزینه ارسال مرسوله ({sh.carrier ?? "—"})</td><td className="border border-slate-400 p-1.5">۱</td><td className="border border-slate-400 p-1.5">{faNum(sh.shippingCost)}</td><td className="border border-slate-400 p-1.5">{faNum(sh.shippingCost)}</td><td className="border border-slate-400 p-1.5">۰</td><td className="border border-slate-400 p-1.5">{faNum(sh.shippingCost)}</td></tr>
          </tbody>
          <tfoot className="font-bold">
            <tr><td colSpan={4} className="border border-slate-400 p-1.5 text-left">جمع</td><td className="border border-slate-400 p-1.5">{faNum(itemsTotal + sh.shippingCost)}</td><td className="border border-slate-400 p-1.5">{faNum(taxTotal)}</td><td className="border border-slate-400 bg-slate-100 p-1.5">{faNum(grand)}</td></tr>
          </tfoot>
        </table>
        <div className="mt-3 text-left text-xs">مبالغ به تومان</div>
        <div className="mt-2">{sh.sellerId ? <div className="rounded-lg border border-slate-400 p-2 text-xs">وضعیت پرداخت: {o.paymentStatus === "paid" ? "پرداخت‌شده توسط خریدار به مارکت‌پلیس (امانی)" : "پرداخت‌نشده"}</div> : <PaymentInfoBox pays={pays} />}</div>
        {agency && <p className="mt-3 rounded border border-dashed border-slate-400 p-2 text-xs">این صورتحساب به نیابت از فروشنده «{seller?.shopName}» و بر اساس قرارداد حق‌العمل‌کاری صادر شده است. مسئولیت اصالت و گارانتی کالا با فروشنده است.</p>}
        <p className="mt-3 text-xs text-slate-600">{s.invoiceFooter}</p>
        <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs"><div className="border-t border-slate-400 pt-2">مهر و امضای فروشنده</div><div className="border-t border-slate-400 pt-2">امضای خریدار</div></footer>
      </div>
    </div>
  );
}
