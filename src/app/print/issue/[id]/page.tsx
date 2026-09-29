import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, sellers, users, warehouseIssues } from "@/db/schema";
import { can, getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ISSUE_STATUS } from "@/lib/services/warehouse";
import { PrintButton } from "@/components/PrintButton";
import { Barcode } from "@/components/LabelView";
import { faNum, jdate } from "@/lib/util";

export const metadata = { title: "حواله خروج از انبار" };

export default async function IssuePrint({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [iss] = await db.select().from(warehouseIssues).where(eq(warehouseIssues.id, id));
  if (!iss) notFound();
  const staffOk = u.staff && (can(u, "INVENTORY_MANAGE") || can(u, "SHIPMENTS_MANAGE") || can(u, "ORDERS_VIEW"));
  if (!staffOk && !(u.sellerId && iss.sellerId === u.sellerId)) notFound();
  const [o] = await db.select().from(orders).where(eq(orders.id, iss.orderId));
  const [seller] = iss.sellerId ? await db.select().from(sellers).where(eq(sellers.id, iss.sellerId)) : [];
  const ppl = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [iss.issuedBy, iss.handedOverBy ?? 0]));
  const nm = (x: number | null) => ppl.find((p) => p.id === x)?.name ?? "";
  const s = await getSettings();
  const total = iss.items.reduce((a, i) => a + i.qty, 0);
  const cell = "border border-slate-500 p-1.5";
  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-4 flex justify-between px-2"><Link href={u.staff ? `/orders/${iss.orderId}` : `/seller/orders/${iss.orderId}`} className="btn-ghost">بازگشت</Link><PrintButton label="چاپ حواله" /></div>
      <div className="invoice-sheet relative bg-white p-8 text-[12.5px] leading-7 text-black shadow print:shadow-none">
        {iss.status === "cancelled" && <div className="pointer-events-none absolute inset-0 grid place-items-center text-7xl font-black text-rose-500/25 -rotate-12">باطل شد</div>}
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div><div className="text-xl font-black">{seller ? seller.shopName : s.siteName}</div><div className="text-xs">{iss.warehouseName}</div></div>
          <div className="text-center"><div className="text-2xl font-black">حواله خروج کالا از انبار</div><div className="text-xs">{ISSUE_STATUS[iss.status]}</div></div>
          <div className="w-44 text-left text-xs"><div>شماره حواله: <b dir="ltr">{iss.number}</b></div><div>تاریخ صدور: <b>{jdate(iss.issuedAt, true)}</b></div><div className="mt-1"><Barcode value={iss.number} height={28} /></div></div>
        </header>
        <section className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <div className="rounded border border-slate-500 p-2">شماره سفارش: <b dir="ltr">{o.number}</b><br />مرسوله: <b>#{faNum(iss.shipmentId)}</b></div>
          <div className="rounded border border-slate-500 p-2">مقصد: <b>{o.address.city}</b><br />گیرنده نهایی: <b>{o.address.fullName}</b></div>
          <div className="rounded border border-slate-500 p-2">تعداد بسته: <b>{faNum(iss.packageCount)}</b><br />روش ارسال: <b>{iss.carrier ?? "—"}</b></div>
        </section>
        <table className="mt-4 w-full border-collapse text-center text-[12px]">
          <thead><tr className="bg-slate-100">{["ردیف", "شرح کالا", "کد کالا (SKU)", "کد محصول", "تعداد", "کنترل"].map((h) => <th key={h} className={cell}>{h}</th>)}</tr></thead>
          <tbody>
            {iss.items.map((i, k) => <tr key={k}><td className={cell}>{faNum(k + 1)}</td><td className={`${cell} text-right`}>{i.title}</td><td className={cell} dir="ltr">{i.sku}</td><td className={cell} dir="ltr">{i.partNumber}</td><td className={`${cell} font-bold`}>{faNum(i.qty)}</td><td className={cell}>☐</td></tr>)}
            <tr className="font-bold"><td colSpan={4} className={`${cell} text-left`}>جمع اقلام</td><td className={cell}>{faNum(total)}</td><td className={cell} /></tr>
          </tbody>
        </table>
        {iss.notes && <p className="mt-3 text-xs">توضیحات: {iss.notes}</p>}
        <section className="mt-4 rounded border border-slate-500 p-3 text-xs">
          <b className="mb-1 block">مشخصات تحویل‌گیرنده (مأمور ارسال)</b>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>نام: <b>{iss.receiverName ?? "................................"}</b></div><div>سمت: <b>{iss.receiverRole ?? "................"}</b></div>
            <div>کد ملی: <b dir="ltr">{iss.receiverNationalId ?? "................"}</b></div><div>تلفن: <b dir="ltr">{iss.receiverPhone ?? "................"}</b></div>
          </div>
          <div className="mt-1">زمان تحویل: <b>{iss.handedOverAt ? jdate(iss.handedOverAt, true) : "......../......../........ ساعت ........"}</b></div>
        </section>
        <p className="mt-3 text-[11px] leading-6">اقلام فوق با تعداد و مشخصات ذکرشده، سالم و در بسته‌بندی پلمب از انبار تحویل گرفته شد و مسئولیت حفظ و رساندن آن به مقصد از این لحظه بر عهده تحویل‌گیرنده است.</p>
        <footer className="mt-10 grid grid-cols-3 gap-8 text-center text-xs">
          <div className="border-t border-slate-500 pt-2">صادرکننده حواله<br /><b>{nm(iss.issuedBy)}</b></div>
          <div className="border-t border-slate-500 pt-2">امضای انباردار (تحویل‌دهنده)<br /><b>{nm(iss.handedOverBy)}</b></div>
          <div className="border-t border-slate-500 pt-2">امضای تحویل‌گیرنده (مأمور ارسال)<br /><b>{iss.receiverName ?? ""}</b></div>
        </footer>
      </div>
    </div>
  );
}
