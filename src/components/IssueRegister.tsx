import Link from "next/link";
import { and, desc, eq, inArray, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders, sellerShipments, users, warehouseIssues } from "@/db/schema";
import { ISSUE_STATUS } from "@/lib/services/warehouse";
import { faNum, jdate } from "@/lib/util";
import { PageHeader, Table, Td, Badge } from "./ui";
import { IssuePanel } from "./IssuePanel";

/** Shared register: central warehouse (sellerId=null) for staff, or one seller's own warehouse. */
export async function IssueRegister({ sellerId, status, base }: { sellerId: number | null; status?: string; base: string }) {
  const own = sellerId === null ? isNull(warehouseIssues.sellerId) : eq(warehouseIssues.sellerId, sellerId);
  const c: SQL[] = [own];
  if (status) c.push(eq(warehouseIssues.status, status));
  const list = await db.select({ i: warehouseIssues, number: orders.number }).from(warehouseIssues).innerJoin(orders, eq(orders.id, warehouseIssues.orderId)).where(and(...c)).orderBy(desc(warehouseIssues.issuedAt)).limit(300);
  const ppl = list.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, list.flatMap((x) => [x.i.issuedBy, x.i.handedOverBy ?? 0]))) : [];
  const nm = (id: number | null) => ppl.find((p) => p.id === id)?.name ?? "—";
  const withIssue = await db.select({ id: warehouseIssues.shipmentId }).from(warehouseIssues).where(and(own, sql`${warehouseIssues.status} <> 'cancelled'`));
  const shOwn = sellerId === null ? isNull(sellerShipments.sellerId) : eq(sellerShipments.sellerId, sellerId);
  const waiting = await db.select({ sh: sellerShipments, number: orders.number, city: sql<string>`${orders.address}->>'city'` }).from(sellerShipments).innerJoin(orders, eq(orders.id, sellerShipments.orderId))
    .where(and(shOwn, eq(orders.paymentStatus, "paid"), inArray(sellerShipments.status, ["pending", "preparing", "ready"]), withIssue.length ? notInArray(sellerShipments.id, withIssue.map((w) => w.id)) : undefined)).orderBy(sellerShipments.createdAt);
  const counts = { issued: list.filter((x) => x.i.status === "issued").length, delivered: list.filter((x) => x.i.status === "delivered").length };
  const orderHref = (id: number) => (sellerId === null ? `/orders/${id}` : `/seller/orders/${id}`);
  return (
    <>
      <PageHeader title="حواله‌های خروج از انبار" subtitle={`سند رسمی خروج کالا و تحویل به مأمور ارسال · ${faNum(counts.issued)} در انتظار تحویل · ${faNum(counts.delivered)} تحویل‌شده`} />
      {waiting.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <b className="text-sm text-amber-900">مرسوله‌های آماده خروج بدون حواله ({faNum(waiting.length)})</b>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {waiting.map(({ sh, number, city }) => (
              <div key={sh.id} className="space-y-1 rounded-xl bg-white p-2">
                <div className="flex justify-between text-xs"><Link href={orderHref(sh.orderId)} className="font-bold text-emerald-700" dir="ltr">{number}</Link><span>مرسوله #{faNum(sh.id)} · {city} · {faNum(sh.packageCount)} بسته</span></div>
                <IssuePanel shipmentId={sh.id} packageCount={sh.packageCount} issue={null} canIssue />
              </div>
            ))}
          </div>
        </section>
      )}
      <form className="mb-4 flex gap-2"><select name="status" defaultValue={status ?? ""} className="input !w-56"><option value="">همه حواله‌ها</option>{Object.entries(ISSUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn-ghost">فیلتر</button><Link href={base} className="btn-ghost">حذف فیلتر</Link></form>
      <Table head={["شماره حواله", "سفارش / مرسوله", "اقلام", "صادرکننده", "تحویل‌گیرنده", "وضعیت", "عملیات"]} empty={!list.length}>
        {list.map(({ i, number }) => (
          <tr key={i.id} className="align-top">
            <Td><b dir="ltr" className="font-mono">{i.number}</b><div className="text-[11px] text-slate-400">{jdate(i.issuedAt, true)}</div></Td>
            <Td><Link href={orderHref(i.orderId)} className="text-emerald-700" dir="ltr">{number}</Link><div className="text-[11px]">#{faNum(i.shipmentId)} · {faNum(i.packageCount)} بسته</div></Td>
            <Td className="text-xs">{i.items.map((x, k) => <div key={k}>{x.title} × {faNum(x.qty)}</div>)}</Td>
            <Td className="text-xs">{nm(i.issuedBy)}</Td>
            <Td className="text-xs">{i.receiverName ? <>{i.receiverName}<div className="text-slate-400">{i.receiverRole} · {jdate(i.handedOverAt, true)}</div><div className="text-slate-400">تحویل‌دهنده: {nm(i.handedOverBy)}</div></> : "—"}</Td>
            <Td><Badge tone={i.status === "delivered" ? "green" : i.status === "issued" ? "yellow" : "gray"}>{ISSUE_STATUS[i.status]}</Badge>{i.cancelReason && <div className="text-[11px] text-slate-400">{i.cancelReason}</div>}</Td>
            <Td><div className="w-72"><IssuePanel shipmentId={i.shipmentId} issue={{ id: i.id, number: i.number, status: i.status, receiverName: i.receiverName, handedOverAt: i.handedOverAt?.toISOString() ?? null }} canIssue /></div></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
