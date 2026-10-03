import Link from "next/link";
import { and, count, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { centralPosSales, orders, sellers, sellerShipments } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { activeCarriers } from "@/lib/marketing";
import { PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { ShipmentActions, ShipmentInfoEditor } from "@/components/ShipmentActions";
import { SHIPMENT_STATUS, faNum, jdate, toman } from "@/lib/util";
import { Pagination } from "@/components/Pagination";
import { paginationParams } from "@/lib/pagination";
import { CentralPosShipmentActions } from "@/components/CentralPosShipmentActions";

export default async function AdminShipments({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; pageSize?: string; posPage?: string; posPageSize?: string }> }) {
  await requirePage({ perm: "SHIPMENTS_MANAGE" });
  const sp = await searchParams;
  const c: SQL[] = [];
  if (sp.status) c.push(eq(sellerShipments.status, sp.status));
  if (sp.q) c.push(ilike(orders.number, `%${sp.q}%`));
  const [{ total }] = await db.select({ total: count() }).from(sellerShipments).innerJoin(orders, eq(orders.id, sellerShipments.orderId)).where(and(eq(orders.paymentStatus, "paid"), ...c));
  const { page: requestedPage, pageSize } = paginationParams(sp);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const posPageSizeRaw = Number(sp.posPageSize);
  const posPageSize = [10, 25, 50, 100].includes(posPageSizeRaw) ? posPageSizeRaw : 25;
  const posRequestedPage = Math.max(1, Math.floor(Number(sp.posPage) || 1));
  const posConditions = [isNotNull(centralPosSales.shippingAddress)];
  if (sp.status) posConditions.push(eq(centralPosSales.shippingStatus, sp.status));
  if (sp.q) posConditions.push(or(ilike(centralPosSales.number, `%${sp.q}%`), ilike(centralPosSales.customerName, `%${sp.q}%`), ilike(centralPosSales.customerPhone, `%${sp.q}%`))!);
  const [{ total: posTotal }] = await db.select({ total: count() }).from(centralPosSales).where(and(...posConditions));
  const posPage = Math.min(posRequestedPage, Math.max(1, Math.ceil(posTotal / posPageSize)));
  const [list, centralSales, carriers] = await Promise.all([
    db.select({ sh: sellerShipments, o: orders, shop: sellers.shopName }).from(sellerShipments).innerJoin(orders, eq(orders.id, sellerShipments.orderId)).leftJoin(sellers, eq(sellers.id, sellerShipments.sellerId))
      .where(and(eq(orders.paymentStatus, "paid"), ...c)).orderBy(desc(sellerShipments.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select().from(centralPosSales).where(and(...posConditions)).orderBy(desc(centralPosSales.createdAt)).limit(posPageSize).offset((posPage - 1) * posPageSize),
    activeCarriers(),
  ]);
  const cl = carriers.map((x) => ({ id: x.id, name: x.name }));
  const iso = (d: Date | null) => (d ? new Date(d.getTime() + 3.5 * 36e5).toISOString().slice(0, 10) : null);
  return (
    <>
      <PageHeader title="مدیریت ارسال‌ها" subtitle="تغییر وضعیت، ثبت شرکت پستی، کد رهگیری، تاریخ ارسال و توضیحات هر مرسوله" />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="شماره سفارش" className="input !w-48" dir="ltr" />
        <select name="status" defaultValue={sp.status ?? ""} className="input !w-44"><option value="">همه وضعیت‌ها</option>{Object.entries(SHIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-ghost">فیلتر</button>
      </form>
      <Table head={["مرسوله", "سفارش", "فرستنده", "مقصد", "وزن / هزینه", "وضعیت", "حمل و رهگیری", "عملیات"]} empty={!list.length}>
        {list.map(({ sh, o, shop }) => (
          <tr key={sh.id} className="align-top">
            <Td>#{faNum(sh.id)}<div className="text-[11px] text-slate-400">{jdate(sh.createdAt)}</div></Td>
            <Td><Link href={`/orders/${o.id}`} className="font-bold text-emerald-700" dir="ltr">{o.number}</Link></Td>
            <Td>{shop ?? "انبار مرکزی"}</Td>
            <Td className="text-xs">{o.address.city}<div className="text-slate-400">{o.address.fullName}</div></Td>
            <Td className="text-xs">{faNum(sh.weight)} گرم<div>{toman(sh.shippingCost)}</div></Td>
            <Td><StatusBadge status={sh.status} map={SHIPMENT_STATUS} /></Td>
            <Td className="text-xs">{sh.carrier ?? "—"}<div dir="ltr" className="font-mono">{sh.trackingNumber ?? ""}</div>{sh.shippedAt && <div className="text-slate-400">ارسال: {jdate(sh.shippedAt)}</div>}{sh.notes && <div className="max-w-40 truncate text-slate-400" title={sh.notes}>{sh.notes}</div>}</Td>
            <Td><div className="flex flex-col gap-1.5">
              <ShipmentActions id={sh.id} status={sh.status} base="/api/admin/shipments" allowDeliver carriers={cl} defaultCarrierId={sh.carrierId} />
              {sh.status === "delivered" && <ShipmentInfoEditor id={sh.id} base="/api/admin/shipments" carriers={cl} initial={{ carrierId: sh.carrierId, trackingNumber: sh.trackingNumber, shippedAt: iso(sh.shippedAt), notes: sh.notes }} />}
              <a href={`/print/label/${sh.id}`} target="_blank" className="btn-sm">🏷️ لیبل</a>
            </div></Td>
          </tr>
        ))}
      </Table>
      <div className="mt-4"><Pagination page={page} pageSize={pageSize} total={total} /></div>
      <section className="mt-10">
        <PageHeader title="فروش حضوری انبار مرکزیِ ارسال‌دار" subtitle="فاکتورهایی که هنگام ثبت فروش، گزینه ارسال برای آن‌ها فعال شده است." />
        <Table head={["فاکتور","تاریخ / مشتری","مقصد و کد پستی","هزینه و شرکت پستی","وضعیت ارسال","رهگیری / عملیات"]} empty={!centralSales.length}>
          {centralSales.map((sale) => <tr key={sale.id} className="align-top">
            <Td><Link href={`/admin/pos/invoice/${sale.id}`} className="font-bold text-emerald-700" dir="ltr">{sale.number}</Link><div className="mt-1">{toman(sale.total)}</div></Td>
            <Td>{jdate(sale.createdAt,true)}<div>{sale.customerName}</div><div className="text-xs text-slate-400" dir="ltr">{sale.customerPhone}</div></Td>
            <Td className="max-w-64 text-xs">{sale.shippingCity}<div className="my-1 leading-6">{sale.shippingAddress}</div><span dir="ltr">{sale.shippingPostalCode}</span></Td>
            <Td className="text-xs">{sale.shippingCarrierName ?? "—"}<div className="mt-1">{toman(sale.shippingCost)}</div></Td>
            <Td><StatusBadge status={sale.shippingStatus} map={SHIPMENT_STATUS}/></Td>
            <Td><div className="mb-2 text-xs" dir="ltr">{sale.shippingTrackingNumber ?? "—"}</div>{sale.shippingShippedAt&&<div className="mb-2 text-xs text-slate-400">ارسال: {jdate(sale.shippingShippedAt,true)}</div>}{sale.shippingNotes&&<div className="mb-2 max-w-40 text-xs text-slate-500">{sale.shippingNotes}</div>}<div className="flex flex-col items-start gap-2"><CentralPosShipmentActions id={sale.id} status={sale.shippingStatus} carrierId={sale.shippingCarrierId} trackingNumber={sale.shippingTrackingNumber} shippedAt={sale.shippingShippedAt?iso(sale.shippingShippedAt):null} notes={sale.shippingNotes} carriers={cl}/><a className="btn-sm" href={`/print/pos-label/${sale.id}`} target="_blank">🏷️ لیبل پستی</a></div></Td>
          </tr>)}
        </Table>
        {posTotal>0&&<div className="mt-4"><Pagination page={posPage} pageSize={posPageSize} total={posTotal} pageKey="posPage" pageSizeKey="posPageSize"/></div>}
      </section>
    </>
  );
}
