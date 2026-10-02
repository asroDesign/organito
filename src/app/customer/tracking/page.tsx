import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Search, Truck } from "lucide-react";
import { db } from "@/db";
import { orders, sellerShipments, sellers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Empty, StatusBadge } from "@/components/ui";
import { ShipmentTimeline, carrierMap } from "@/components/ShipmentTimeline";
import { ORDER_STATUS, jdate, toman } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "پیگیری سفارش" };

export default async function Tracking({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const u = await requirePage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  let list = await db.select().from(orders).where(eq(orders.customerId, u.id)).orderBy(desc(orders.createdAt));
  if (q) list = list.filter((o) => o.number.toLowerCase().includes(q.toLowerCase()));
  else if (!sp.all) list = list.filter((o) => ["paid", "processing", "shipped", "pending_payment"].includes(o.status));
  const shs = list.length ? await db.select({ sh: sellerShipments, shop: sellers.shopName }).from(sellerShipments).leftJoin(sellers, eq(sellers.id, sellerShipments.sellerId)).where(and(inArray(sellerShipments.orderId, list.map((o) => o.id)))) : [];
  const cmap = await carrierMap(shs.map((x) => x.sh));
  const st = await getSettings();
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-l from-emerald-600 to-teal-700 p-6 text-white">
        <div className="flex items-center gap-3"><Truck className="h-8 w-8" /><div><h1 className="text-2xl font-black">پیگیری سفارش</h1><p className="text-sm text-white/80">وضعیت لحظه‌ای مرسوله‌ها، شرکت پستی و کد رهگیری</p></div></div>
        <form className="mt-5 flex max-w-lg gap-2 rounded-2xl bg-white p-1.5">
          <input name="q" defaultValue={q} placeholder="شماره سفارش، مثلاً YT-1234567" dir="ltr" className="flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none" />
          <button className="btn-primary"><Search className="h-4 w-4" />پیگیری</button>
        </form>
        <div className="mt-3 flex gap-2 text-xs"><Link href="/customer/tracking" className={`rounded-full px-3 py-1 ${!sp.all ? "bg-white text-emerald-700" : "bg-white/15"}`}>سفارش‌های در جریان</Link><Link href="/customer/tracking?all=1" className={`rounded-full px-3 py-1 ${sp.all ? "bg-white text-emerald-700" : "bg-white/15"}`}>همه سفارش‌ها</Link></div>
      </div>
      {list.length === 0 ? <Empty title={q ? "سفارشی با این شماره یافت نشد" : "سفارش در جریانی ندارید"} action={<Link href="/customer/tracking?all=1" className="btn-ghost mt-2">نمایش همه سفارش‌ها</Link>} /> : list.map((o) => (
        <section key={o.id} className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><b dir="ltr" className="text-lg">{o.number}</b><div className="text-xs text-slate-500">{jdate(o.createdAt, true)} · {toman(o.total)}</div></div>
            <div className="flex items-center gap-2"><StatusBadge status={o.status} map={ORDER_STATUS} /><Link href={`/customer/orders/${o.id}`} className="btn-sm">جزئیات سفارش</Link></div>
          </div>
          {o.status === "pending_payment" && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">این سفارش هنوز پرداخت نشده است. <Link href={`/customer/orders/${o.id}`} className="font-bold underline">پرداخت</Link></div>}
          <div className="space-y-3">{shs.filter((x) => x.sh.orderId === o.id).map(({ sh, shop }) => <ShipmentTimeline key={sh.id} sh={sh} title={st.multiVendor ? shop ?? `انبار مرکزی ${st.siteName}` : st.siteName} trackingUrl={sh.carrierId ? cmap.get(sh.carrierId)?.trackingUrl : null} />)}</div>
        </section>
      ))}
    </div>
  );
}
