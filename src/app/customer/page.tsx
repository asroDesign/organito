import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { ShoppingBag, Clock, CheckCircle2, Search, Truck, LifeBuoy, User, Store, ArrowLeft, Wallet, BadgePercent, Award, ArrowUpLeft } from "lucide-react";
import { db } from "@/db";
import { discountCodes, orders, sellerShipments, supplyRequests, tickets } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Empty, StatusBadge } from "@/components/ui";
import { ORDER_STATUS, SUPPLY_STATUS, TICKET_STATUS, faNum, jdate, toman } from "@/lib/util";
import { customerLoyaltyTier } from "@/lib/services/loyalty-tiers";

const PROGRESS: Record<string, number> = { pending_payment: 10, paid: 30, processing: 55, shipped: 80, completed: 100, cancelled: 100 };

export default async function CustomerHome() {
  const u = await requirePage();
  const [list, reqs, tks, myCodes] = await Promise.all([
    db.select().from(orders).where(eq(orders.customerId, u.id)).orderBy(desc(orders.createdAt)),
    db.select().from(supplyRequests).where(eq(supplyRequests.customerId, u.id)).orderBy(desc(supplyRequests.updatedAt)).limit(4),
    db.select().from(tickets).where(eq(tickets.customerId, u.id)).orderBy(desc(tickets.updatedAt)).limit(4),
    db.select().from(discountCodes).where(eq(discountCodes.customerId, u.id)),
  ]);
  const active = list.filter((o) => ["pending_payment", "paid", "processing", "shipped"].includes(o.status));
  const shs = active.length ? await db.select().from(sellerShipments).where(inArray(sellerShipments.orderId, active.map((o) => o.id))) : [];
  const spent = list.filter((o) => o.paymentStatus === "paid").reduce((a, o) => a + o.total, 0);
  const loyaltyTier = await customerLoyaltyTier(db, u.id, u.phone);
  const saved = list.filter((o) => o.paymentStatus === "paid").reduce((a, o) => a + o.discount, 0);
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: "Asia/Tehran" }).format(new Date()));
  const greet = hour < 12 ? "صبح بخیر" : hour < 18 ? "روز بخیر" : "عصر بخیر";
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-900 via-emerald-900 to-emerald-700 p-6 text-white">
        <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/5" /><div className="absolute -bottom-16 left-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-black">{u.name.slice(0, 1)}</span><div><div className="text-sm text-white/70">{greet}</div><h1 className="text-2xl font-black">{u.name}</h1><div className="text-xs text-white/60" dir="ltr">{u.phone}</div></div></div>
          <div className="flex flex-wrap gap-2"><Link href="/shop" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900">ادامه خرید</Link><Link href="/customer/tracking" className="rounded-xl bg-white/15 px-4 py-2 text-sm">پیگیری سفارش</Link><Link href="/customer/alerts" className="rounded-xl bg-white/15 px-4 py-2 text-sm">اعلان‌های محصول</Link></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[[ShoppingBag, "کل سفارش‌ها", faNum(list.length), "bg-emerald-100 text-emerald-700"], [Clock, "در جریان", faNum(active.length), "bg-amber-100 text-amber-700"], [Wallet, "مجموع خرید", toman(spent), "bg-emerald-100 text-emerald-700"], [BadgePercent, "سود شما از تخفیف‌ها", toman(saved), "bg-rose-100 text-rose-700"]].map(([I, l, v, c]) => {
          const Icon = I as typeof Clock;
          return <div key={l as string} className="rounded-2xl border border-slate-200 bg-white p-4"><span className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${c as string}`}><Icon className="h-5 w-5" /></span><div className="text-xs text-slate-500">{l as string}</div><b className="text-lg">{v as string}</b></div>;
        })}
      </div>

      {loyaltyTier.enabled && <Link href="/customer/loyalty" className="block overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 via-white to-yellow-50 p-5 shadow-sm transition hover:border-amber-300"><div className="flex flex-wrap items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Award className="size-6"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-lg">سطح {loyaltyTier.name}</b><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-800">ضریب امتیاز {faNum(loyaltyTier.pointsMultiplierBps / 10000)}×</span></div><p className="mt-1 text-sm text-slate-600">مجموع خرید واجد شرایط: {toman(loyaltyTier.lifetimeSpent)}{loyaltyTier.nextTier ? ` · ${toman(loyaltyTier.nextTier.minimumSpend - loyaltyTier.lifetimeSpent)} تا سطح ${loyaltyTier.nextTier.name}` : " · بالاترین سطح باشگاه"}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-yellow-500" style={{width:`${loyaltyTier.progress}%`}}/></div></div><ArrowUpLeft className="size-5 text-amber-700"/></div></Link>}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[[Truck, "پیگیری", "/customer/tracking"], [Search, "سفارش ویژه", "/customer/supply"], [LifeBuoy, "تیکت", "/customer/tickets"], [User, "پروفایل", "/customer/profile"], [Store, "فروشگاه", "/shop"], [CheckCircle2, "سفارش‌ها", "/customer/orders"]].map(([I, l, h]) => {
          const Icon = I as typeof Truck;
          return <Link key={h as string} href={h as string} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium transition hover:border-emerald-300 hover:text-emerald-700"><Icon className="h-6 w-6 text-emerald-600" />{l as string}</Link>;
        })}
      </div>

      {myCodes.length > 0 && (
        <div className="flex flex-wrap gap-3">{myCodes.filter((c) => c.isActive).map((c) => <div key={c.id} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 px-4 py-3"><BadgePercent className="h-6 w-6 text-rose-500" /><div><div className="text-xs text-rose-700">کد تخفیف اختصاصی شما</div><b dir="ltr" className="font-mono text-rose-800">{c.code}</b> <span className="text-xs text-slate-600">— {c.title}</span></div></div>)}</div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-black">سفارش‌های در جریان</h2><Link href="/customer/orders" className="flex items-center gap-1 text-sm text-emerald-700">همه سفارش‌ها<ArrowLeft className="h-4 w-4" /></Link></div>
        {active.length === 0 ? <Empty title="سفارش فعالی ندارید" action={<Link href="/shop" className="btn-primary mt-2">شروع خرید</Link>} /> : (
          <div className="space-y-3">{active.map((o) => {
            const mine = shs.filter((s) => s.orderId === o.id);
            const shipped = mine.filter((s) => ["shipped", "delivered"].includes(s.status)).length;
            return (
              <Link key={o.id} href={`/customer/orders/${o.id}`} className="block rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-emerald-200 hover:bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><b dir="ltr">{o.number}</b><span className="mr-2 text-xs text-slate-500">{jdate(o.createdAt)}</span></div><div className="flex items-center gap-2"><b className="text-sm">{toman(o.total)}</b><StatusBadge status={o.status} map={ORDER_STATUS} /></div></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-500" style={{ width: `${PROGRESS[o.status] ?? 0}%` }} /></div>
                <div className="mt-2 text-xs text-slate-500">{faNum(shipped)} از {faNum(mine.length)} مرسوله ارسال شده</div>
              </Link>
            );
          })}</div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-black">استعلام‌های اخیر</h2><Link href="/customer/supply" className="text-sm text-emerald-700">ثبت استعلام</Link></div>
          {reqs.length === 0 ? <p className="text-sm text-slate-500">استعلامی ثبت نکرده‌اید.</p> : <div className="divide-y">{reqs.map((r) => <Link key={r.id} href={`/customer/supply/${r.id}`} className="flex items-center justify-between py-2.5 text-sm"><span>{r.partName || r.partNumber || r.vin}<span className="mr-2 text-xs text-slate-400" dir="ltr">{r.number}</span></span><StatusBadge status={r.status} map={SUPPLY_STATUS} /></Link>)}</div>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-black">تیکت‌های پشتیبانی</h2><Link href="/customer/tickets" className="text-sm text-emerald-700">تیکت جدید</Link></div>
          {tks.length === 0 ? <p className="text-sm text-slate-500">تیکتی ندارید.</p> : <div className="divide-y">{tks.map((t) => <Link key={t.id} href={`/customer/tickets/${t.id}`} className="flex items-center justify-between py-2.5 text-sm"><span>{t.subject}</span><StatusBadge status={t.status} map={TICKET_STATUS} /></Link>)}</div>}
        </section>
      </div>
    </div>
  );
}
