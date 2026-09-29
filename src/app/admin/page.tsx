import Link from "next/link";
import { desc, eq, sql, count } from "drizzle-orm";
import { ShoppingBag, Package, Store, Search, Wallet, AlertTriangle, TrendingUp, LifeBuoy } from "lucide-react";
import { db } from "@/db";
import { orders, products, sellerOffers, sellers, supplyRequests, tickets, withdrawals } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { ORDER_STATUS, faNum, jdate, toman } from "@/lib/util";
import { IntegrityCheck } from "@/components/IntegrityCheck";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const u = await requirePage({ role: "staff" });
  const sp = await searchParams;
  const [[sales], [pendingProducts], [pendingOffers], [openSupply], [pendingWd], [lowStock], [openTickets], [sellerCount]] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${orders.total}),0)::bigint`, n: count() }).from(orders).where(sql`${orders.paymentStatus} = 'paid'`),
    db.select({ n: count() }).from(products).where(eq(products.status, "pending")),
    db.select({ n: count() }).from(sellerOffers).where(eq(sellerOffers.status, "pending")),
    db.select({ n: count() }).from(supplyRequests).where(sql`${supplyRequests.status} not in ('completed','cancelled','rejected')`),
    db.select({ n: count(), s: sql<number>`coalesce(sum(${withdrawals.amount}),0)::bigint` }).from(withdrawals).where(eq(withdrawals.status, "pending")),
    db.select({ n: count() }).from(products).where(sql`${products.source} = 'central' and ${products.status} = 'active' and ${products.onHand} - ${products.reserved} <= ${products.lowStockThreshold}`),
    db.select({ n: count() }).from(tickets).where(sql`${tickets.status} not in ('resolved','closed')`),
    db.select({ n: count() }).from(sellers).where(eq(sellers.status, "approved")),
  ]);
  const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
  const daily = await db.execute(sql`select to_char(created_at at time zone 'Asia/Tehran', 'MM-DD') d, sum(total)::bigint t from orders where payment_status='paid' and created_at > now() - interval '14 days' group by 1 order by 1`);
  const rows = daily.rows as { d: string; t: string }[];
  const max = Math.max(1, ...rows.map((r) => Number(r.t)));
  return (
    <>
      {sp.denied && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">شما مجوز دسترسی به آن بخش را ندارید.</div>}
      <PageHeader title="داشبورد مدیریت" subtitle={`خوش آمدید ${u.name}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="فروش پرداخت‌شده" value={toman(Number(sales.total))} icon={TrendingUp} tone="green" hint={`${faNum(sales.n)} سفارش`} />
        <Stat label="محصولات در انتظار تأیید" value={faNum(pendingProducts.n)} icon={Package} tone="yellow" />
        <Stat label="پیشنهادهای در انتظار" value={faNum(pendingOffers.n)} icon={Store} tone="yellow" hint={`${faNum(sellerCount.n)} فروشنده فعال`} />
        <Stat label="استعلام‌های باز" value={faNum(openSupply.n)} icon={Search} tone="violet" />
        <Stat label="برداشت‌های در انتظار" value={faNum(pendingWd.n)} icon={Wallet} tone="blue" hint={toman(Number(pendingWd.s))} />
        <Stat label="هشدار موجودی کم" value={faNum(lowStock.n)} icon={AlertTriangle} tone="red" />
        <Stat label="تیکت‌های باز" value={faNum(openTickets.n)} icon={LifeBuoy} tone="blue" />
        <Stat label="کل سفارش‌ها" value={faNum(recent.length ? (await db.select({ n: count() }).from(orders))[0].n : 0)} icon={ShoppingBag} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="فروش ۱۴ روز اخیر" className="lg:col-span-2">
          {rows.length === 0 ? <p className="text-sm text-slate-500">هنوز فروشی ثبت نشده است.</p> : (
            <div className="flex h-48 items-end gap-2">{rows.map((r) => <div key={r.d} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${(Number(r.t) / max) * 100}%` }} title={toman(Number(r.t))} /><span className="text-[10px] text-slate-500" dir="ltr">{r.d}</span></div>)}</div>
          )}
        </Card>
        {u.permissions.includes("AUDIT_LOG_VIEW") ? <Card title="بررسی سلامت مالی و انبار"><IntegrityCheck /></Card> : <Card title="دسترسی‌های شما"><div className="flex flex-wrap gap-1">{u.permissions.map((p) => <span key={p} className="rounded bg-slate-100 px-2 py-0.5 text-[10px]" dir="ltr">{p}</span>)}</div></Card>}
      </div>
      {u.permissions.includes("ORDERS_VIEW") && (
        <Card title="آخرین سفارش‌ها" className="mt-6" action={<Link href="/admin/orders" className="text-sm text-emerald-700">همه</Link>}>
          <div className="divide-y">{recent.map((o) => <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:bg-slate-50"><b dir="ltr">{o.number}</b><span className="hidden text-slate-500 sm:block">{jdate(o.createdAt, true)}</span><span>{toman(o.total)}</span><StatusBadge status={o.status} map={ORDER_STATUS} /></Link>)}</div>
        </Card>
      )}
    </>
  );
}
