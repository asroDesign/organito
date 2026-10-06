import Link from "next/link";
import { loadShipmentForPrint } from "@/lib/printAccess";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { PaymentInfoBox } from "@/components/PaymentInfoBox";
import { Barcode, fillLabel } from "@/components/LabelView";
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
  const box = "rounded-lg border p-3";
  const headerText = fillLabel(s.invoiceHeaderTemplate, { siteName: s.siteName, invoiceNumber: `INV-${o.number}-${sh.id}`, date: jdate(o.createdAt) });
  const invoiceBorder = s.invoiceBorderStyle === "none" ? "none" : s.invoiceBorderStyle === "dashed" ? `2px dashed ${s.invoiceBorderColor}` : `1px solid ${s.invoiceBorderColor}`;
  return (
    <div className="mx-auto" style={{ maxWidth: `${s.invoiceWidth}mm` }}>
      <div className="no-print mb-4 flex justify-between px-2"><Link href={back} className="btn-ghost">بازگشت به سفارش</Link><PrintButton label="چاپ فاکتور" /></div>
      <div className="invoice-sheet bg-white leading-7 text-black shadow print:shadow-none" style={{ fontSize: `${s.invoiceFontSize}px`, border: invoiceBorder, padding: `${s.invoicePadding}mm` }}>
        <header className="flex items-start justify-between border-b-2 pb-3" style={{ borderColor: s.invoiceAccentColor }}>
          <div className="flex items-center gap-2">{!!s.invoiceShowLogo && s.siteLogoMediaId > 0 && <img src={`/api/media/${s.siteLogoMediaId}`} alt="لوگو" className="h-14 w-14 object-contain" />}
            <div>{!!s.invoiceShowSiteName && <div className="text-2xl font-black" style={{ color: s.invoiceAccentColor }}>{s.siteName}</div>}{!!s.invoiceShowTagline && <div className="text-xs">{s.siteTagline}</div>}</div></div>
          {!s.invoiceShowHeaderTemplate && <div className="text-center">
            <div className="text-xl font-black">{agency ? "فاکتور فروش نیابتی (حق‌العمل‌کاری)" : "صورتحساب فروش کالا"}</div>
            <div className="text-xs">{agency ? "صادرشده به نیابت از فروشنده توسط مارکت‌پلیس" : "فروشنده: انبار مرکزی"}</div>
          </div>}
          <div className="text-left text-xs">
            <div>شماره: <b dir="ltr">INV-{o.number}-{sh.id}</b></div><div>تاریخ: <b>{jdate(o.createdAt)}</b></div><div>سفارش: <b dir="ltr">{o.number}</b></div>
            {!!s.invoiceShowInvoiceBarcode && <div className="mt-1 w-40"><Barcode value={`${o.number}-${sh.id}`} height={28} /></div>}
          </div>
        </header>
        {!!s.invoiceShowHeaderTemplate && <div className="mb-4 whitespace-pre-line border-b py-2 text-center font-bold" style={{ borderColor: s.invoiceBorderColor }}>{headerText}</div>}
        {(!!s.invoiceShowSeller || !!s.invoiceShowBuyer || (!!s.invoiceShowOfficialInfo && !agency && !!o.officialInvoiceType && !!o.officialInvoiceDetails)) && <section className="mt-4 grid grid-cols-2 gap-3">
          {!!s.invoiceShowSeller && <div className={box} style={{ borderColor: s.invoiceBorderColor }}>
            <b className="block border-b border-slate-300 pb-1">مشخصات فروشنده</b>
            {agency ? <>
              <div>نام فروشگاه: {seller?.shopName}</div><div>شناسه ملی/کد ملی: {seller?.nationalId ?? "—"}</div><div>شهر: {seller?.city}</div>
              <div className="mt-1 text-xs">حق‌العمل‌کار (واسط): {s.siteName} — کد اقتصادی {s.economicCode}</div>
            </> : <><div>{s.siteName} — {s.senderName}</div><div>کد اقتصادی: {s.economicCode}</div><div>نشانی: {s.senderAddress}</div></>}
          </div>}
          {!!s.invoiceShowBuyer && <div className={box} style={{ borderColor: s.invoiceBorderColor }}>
            <b className="block border-b border-slate-300 pb-1">مشخصات خریدار</b>
            <div>نام: {o.address.fullName} ({customer?.name})</div><div>تلفن: <span dir="ltr">{o.address.phone}</span></div>
            <div>نشانی: {o.address.city} — {o.address.address}</div><div>کد پستی: {o.address.postalCode || "—"}</div>
          </div>}
          {!!s.invoiceShowOfficialInfo && !agency && o.officialInvoiceType && o.officialInvoiceDetails && (
            <div className={`${box} col-span-2 border-2 border-emerald-700`}>
              <b className="block border-b border-slate-300 pb-1">مشخصات صورتحساب رسمی · {o.officialInvoiceType === "company" ? "شخص حقوقی" : "شخص حقیقی"}</b>
              {o.officialInvoiceType === "company" ? (
                <><div>نام شرکت: {o.officialInvoiceDetails.companyName}</div><div>شناسه ملی: <span dir="ltr">{o.officialInvoiceDetails.companyNationalId}</span></div><div>نام مدیرعامل: {o.officialInvoiceDetails.managerName}</div></>
              ) : (
                <><div>نام: {o.officialInvoiceDetails.name}</div><div>کد ملی: <span dir="ltr">{o.officialInvoiceDetails.nationalId}</span></div></>
              )}
            </div>
          )}
        </section>}
        {!!s.invoiceShowItems && <table className="mt-4 w-full border-collapse text-center text-[12px]">
          <thead><tr style={{ backgroundColor: `${s.invoiceAccentColor}18` }}>{["ردیف", "شرح کالا", "تعداد", "مبلغ واحد (تومان)", "مبلغ کل", ...(s.invoiceShowTax ? [`مالیات ${faNum(s.taxRate)}٪`, "جمع با مالیات"] : [])].map((h) => <th key={h} className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((i, k) => <tr key={i.id}>{[faNum(k + 1), i.title, faNum(i.qty), faNum(i.unitPrice), faNum(i.lineTotal), ...(s.invoiceShowTax ? [faNum(tax(i.lineTotal)), faNum(i.lineTotal + tax(i.lineTotal))] : [])].map((v, n) => <td key={n} className={`border p-1.5 ${n === 1 ? "text-right" : ""}`} style={{ borderColor: s.invoiceBorderColor }}>{v}</td>)}</tr>)}
            {!!s.invoiceShowShipping && <tr><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }} /><td className="border p-1.5 text-right" style={{ borderColor: s.invoiceBorderColor }}>{sh.freightCollect ? `ارسال پس‌کرایه (${sh.carrier ?? "—"})؛ پرداخت هزینه به شرکت پستی` : `هزینه ارسال مرسوله (${sh.carrier ?? "—"})`}</td><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>۱</td><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>{faNum(sh.shippingCost)}</td><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>{faNum(sh.shippingCost)}</td>{s.invoiceShowTax && <><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>۰</td><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>{faNum(sh.shippingCost)}</td></>}</tr>}
          </tbody>
          <tfoot className="font-bold">
            <tr><td colSpan={s.invoiceShowTax ? 4 : 3} className="border p-1.5 text-left" style={{ borderColor: s.invoiceBorderColor }}>جمع</td><td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>{faNum(itemsTotal + sh.shippingCost)}</td>{s.invoiceShowTax && <td className="border p-1.5" style={{ borderColor: s.invoiceBorderColor }}>{faNum(taxTotal)}</td>}<td className="border bg-slate-100 p-1.5 font-black" style={{ borderColor: s.invoiceBorderColor, color: s.invoiceAccentColor }}>{faNum(grand)}</td></tr>
          </tfoot>
        </table>}
        <div className="mt-3 text-left text-xs">مبالغ به تومان</div>
        {!!s.invoiceShowPayments && <div className="mt-2">{sh.sellerId ? <div className="rounded-lg border p-2 text-xs" style={{ borderColor: s.invoiceBorderColor }}>وضعیت پرداخت: {o.paymentStatus === "paid" ? "پرداخت‌شده توسط خریدار به مارکت‌پلیس (امانی)" : "پرداخت‌نشده"}</div> : <PaymentInfoBox pays={pays} />}</div>}
        {agency && <p className="mt-3 rounded border border-dashed border-slate-400 p-2 text-xs">این صورتحساب به نیابت از فروشنده «{seller?.shopName}» و بر اساس قرارداد حق‌العمل‌کاری صادر شده است. مسئولیت اصالت و گارانتی کالا با فروشنده است.</p>}
        {!!s.invoiceShowFooter && <p className="mt-3 border-t pt-3 text-xs text-slate-600" style={{ borderColor: s.invoiceBorderColor }}>{s.invoiceFooter}</p>}
        {!!s.invoiceShowSignatures && <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs"><div className="border-t pt-2" style={{ borderColor: s.invoiceBorderColor }}>مهر و امضای فروشنده</div><div className="border-t pt-2" style={{ borderColor: s.invoiceBorderColor }}>امضای خریدار</div></footer>}
      </div>
    </div>
  );
}
