import {InvoiceButton} from "@/components/InvoiceModal";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, sellerShipments, sellerPosSales } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Empty, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { SHIPMENT_STATUS, faNum, jdate, toman } from "@/lib/util";

export default async function SellerOrders() {
  const u = await requirePage({ role: "seller" });
  const list = await db.select({ sh: sellerShipments, o: orders, items: sql<number>`(select count(*) from order_items i where i.shipment_id = ${sellerShipments.id})::int` })
    .from(sellerShipments).innerJoin(orders, eq(orders.id, sellerShipments.orderId)).where(eq(sellerShipments.sellerId, u.sellerId!)).orderBy(desc(sellerShipments.createdAt));
  const pos=await db.select().from(sellerPosSales).where(eq(sellerPosSales.sellerId,u.sellerId!)).orderBy(desc(sellerPosSales.createdAt)).limit(200);
  return (
    <>
      <PageHeader title="سفارش‌ها و مرسوله‌های من" subtitle="فقط اقلام متعلق به شما نمایش داده می‌شود" />
      {list.length === 0 ? <Empty title="سفارشی ندارید" /> : (
        <Table head={["سفارش", "تاریخ", "اقلام", "مبلغ اقلام", "ارسال", "پرداخت", "وضعیت مرسوله", "رهگیری", ""]}>
          {list.map(({ sh, o, items }) => <tr key={sh.id}><Td><b dir="ltr">{o.number}</b></Td><Td>{jdate(sh.createdAt)}</Td><Td>{faNum(items)}</Td><Td>{toman(sh.itemsTotal)}</Td><Td>{toman(sh.shippingCost)}</Td><Td><StatusBadge status={o.paymentStatus} /></Td><Td><StatusBadge status={sh.status} map={SHIPMENT_STATUS} /></Td><Td><span dir="ltr" className="text-xs">{sh.trackingNumber ?? "—"}</span></Td><Td><Link href={`/seller/orders/${o.id}`} className="btn-sm">مدیریت</Link></Td></tr>)}
        </Table>
      )}
      <h2 className="mb-3 mt-8 text-lg font-black">فاکتورهای حضوری من</h2><Table head={["فاکتور","مشتری","تاریخ","مبلغ","وضعیت",""]} empty={!pos.length}>{pos.map(s=><tr key={s.id}><Td>{s.number}</Td><Td>{s.customerName}</Td><Td>{jdate(s.createdAt,true)}</Td><Td>{toman(s.total)}</Td><Td>{s.status==="returned"?"مرجوع شده":"تسویه شده"}</Td><Td><InvoiceButton src={`/print/pos/seller/${s.id}`}/></Td></tr>)}</Table>
    </>
  );
}
