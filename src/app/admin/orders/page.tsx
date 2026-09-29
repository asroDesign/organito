import Link from "next/link";
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { ORDER_STATUS, jdate, toman } from "@/lib/util";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; pay?: string }> }) {
  await requirePage({ perm: "ORDERS_VIEW" });
  const sp = await searchParams;
  const conds: SQL[] = [];
  if (sp.status) conds.push(eq(orders.status, sp.status));
  if (sp.q) conds.push(ilike(orders.number, `%${sp.q}%`));
  if (sp.pay) conds.push(eq(orders.paymentStatus, sp.pay));
  const list = await db.select({ o: orders, name: users.name }).from(orders).innerJoin(users, eq(users.id, orders.customerId)).where(conds.length ? and(...conds) : undefined).orderBy(desc(orders.createdAt)).limit(200);
  return (
    <>
      <PageHeader title="سفارش‌ها" />
      <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="شماره سفارش" className="input !w-52" />
        <select name="status" defaultValue={sp.status ?? ""} className="input !w-44"><option value="">همه</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select name="pay" defaultValue={sp.pay ?? ""} className="input !w-48"><option value="">همه وضعیت‌های پرداخت</option><option value="unpaid">پرداخت‌نشده</option><option value="pending_verification">در انتظار تأیید فیش</option><option value="paid">پرداخت‌شده</option><option value="refunded">مسترد</option></select><button className="btn-ghost">فیلتر</button></form>
      <Table head={["شماره", "مشتری", "تاریخ", "مبلغ", "وضعیت", "پرداخت", ""]} empty={!list.length}>
        {list.map(({ o, name }) => <tr key={o.id} className="hover:bg-slate-50"><Td><b dir="ltr">{o.number}</b></Td><Td>{name}</Td><Td>{jdate(o.createdAt, true)}</Td><Td>{toman(o.total)}</Td><Td><StatusBadge status={o.status} map={ORDER_STATUS} /></Td><Td><StatusBadge status={o.paymentStatus} map={{ paid: "پرداخت‌شده", unpaid: "پرداخت‌نشده", refunded: "مسترد", pending_verification: "در انتظار تأیید فیش" }} /></Td><Td><div className="flex gap-1"><Link href={`/orders/${o.id}`} className="btn-sm">صفحه سفارش</Link><a href={`/print/order/${o.id}`} target="_blank" className="btn-sm">🖨️</a><a href={`/print/order-labels/${o.id}`} target="_blank" className="btn-sm">🏷️</a></div></Td></tr>)}
      </Table>
    </>
  );
}
