import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { Package, Clock, ShoppingBag, Truck, Wallet, Coins, TrendingUp, AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { wallets } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, Stat } from "@/components/ui";
import { faNum, toman } from "@/lib/util";

export default async function SellerHome() {
  const u = await requirePage({ role: "seller" });
  const sid = u.sellerId!;
  const [w] = await db.select().from(wallets).where(eq(wallets.sellerId, sid));
  const r = await db.execute(sql`select
    (select count(*) from products where owner_seller_id = ${sid} and status <> 'deleted')::int products,
    (select count(*) from seller_offers where seller_id = ${sid})::int offers,
    (select count(*) from seller_offers where seller_id = ${sid} and status = 'pending')::int pending_offers,
    (select count(*) from seller_shipments sh join orders o on o.id = sh.order_id where sh.seller_id = ${sid} and sh.status = 'pending' and o.payment_status = 'paid')::int new_orders,
    (select count(*) from seller_shipments where seller_id = ${sid} and status in ('preparing','ready','shipped'))::int open_ship,
    (coalesce((select sum(sh.items_total) from seller_shipments sh join orders o on o.id = sh.order_id where sh.seller_id = ${sid} and o.payment_status='paid' and sh.created_at > now() - interval '30 days'),0) + coalesce((select sum(ps.total) from seller_pos_sales ps where ps.seller_id = ${sid} and ps.created_at > now() - interval '30 days'),0))::bigint sales30,
    (select count(*) from seller_shipments where seller_id = ${sid})::int total_ship,
    (select count(*) from seller_shipments where seller_id = ${sid} and status = 'cancelled')::int cancelled,
    (select count(*) from seller_shipments where seller_id = ${sid} and shipped_at > created_at + (prep_days + 1) * interval '1 day')::int late`);
  const s = r.rows[0] as Record<string, number>;
  const pct = (n: number) => (s.total_ship ? `${faNum(Math.round((n / s.total_ship) * 100))}٪` : "۰٪");
  return (
    <>
      <PageHeader title="داشبورد تأمین‌کننده" subtitle={u.name} actions={<><Link href="/seller/products/new" className="btn-primary">تعریف محصول جدید</Link><Link href="/seller/orders" className="btn-ghost">سفارش‌ها</Link><Link href="/seller/pos" className="btn-ghost">فروش حضوری</Link><Link href="/seller/loyalty" className="btn-ghost">باشگاه مشتریان</Link></>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="محصولات / پیشنهادها" value={`${faNum(s.products)} / ${faNum(s.offers)}`} icon={Package} />
        <Stat label="پیشنهادهای در انتظار تأیید" value={faNum(s.pending_offers)} icon={Clock} tone="yellow" />
        <Stat label="سفارش‌های جدید" value={faNum(s.new_orders)} icon={ShoppingBag} tone="violet" />
        <Stat label="مرسوله‌های باز" value={faNum(s.open_ship)} icon={Truck} tone="blue" />
        <Stat label="در انتظار آزادسازی" value={toman(w?.pendingBalance)} icon={Clock} tone="yellow" />
        <Stat label="قابل برداشت" value={toman(w?.availableBalance)} icon={Wallet} tone="green" />
        <Stat label="فروش ۳۰ روز" value={toman(Number(s.sales30))} icon={TrendingUp} tone="green" />
        <Stat label="نرخ لغو / تأخیر" value={`${pct(s.cancelled)} / ${pct(s.late)}`} icon={AlertTriangle} tone="red" />
      </div>
      <div className="mt-6 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-800 p-6 text-white">
        <Coins className="mb-2 h-8 w-8" /><b className="text-lg">چرخه وجه فروشنده</b>
        <p className="mt-1 text-sm text-emerald-100">پس از پرداخت مشتری، سهم شما در «در انتظار» قرار می‌گیرد؛ پس از تأیید تحویل، کمیسیون کسر و خالص به «قابل برداشت» منتقل می‌شود.</p>
      </div>
    </>
  );
}
