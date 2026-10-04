import Link from "next/link";
import { and, desc, eq, gte, lt, sql, count } from "drizzle-orm";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, BadgeDollarSign, Boxes, CalendarClock, ChartNoAxesCombined, CircleHelp, Eye, LifeBuoy, Package, Search, ShoppingBag, Store, Ticket, TrendingUp, Wallet } from "lucide-react";
import { db } from "@/db";
import { centralPosItems, centralPosSales, marketingCampaigns, orderItems, orders, payments, productViewLogs, products, sellerPosItems, sellerPosSales, sellers, smsLogs, supplyRequests, tickets, users, withdrawals } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { ORDER_STATUS, faNum, jdate, toman } from "@/lib/util";
import { IntegrityCheck } from "@/components/IntegrityCheck";
import { DashboardCharts, type DashboardPoint, type PieSlice } from "@/components/AdminDashboardCharts";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";

type SearchParams = Promise<{ denied?: string; from?: string; to?: string; interval?: string; metric?: string }>;
const dayInTehran = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const validDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`));
const fa = (n: number) => faNum(n);

export default async function AdminHome({ searchParams }: { searchParams: SearchParams }) {
  const u = await requirePage({ role: "staff" });
  const sp = await searchParams;
  const today = dayInTehran();
  const to = validDate(sp.to) ? sp.to! : today;
  const from = validDate(sp.from) ? sp.from! : new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const interval = (["day", "week", "month"].includes(sp.interval ?? "") ? sp.interval : "day") as "day" | "week" | "month";
  const metric = (["revenue", "profit", "orders"].includes(sp.metric ?? "") ? sp.metric : "revenue") as "revenue" | "profit" | "orders";
  const startAt = new Date(`${from}T00:00:00+03:30`);
  const endAt = new Date(Date.parse(`${to}T00:00:00Z`) + 86400000 - 12600000);
  const dayStart = new Date(`${today}T00:00:00+03:30`);
  const tomorrow = new Date(dayStart.getTime() + 86400000);
  const dateFilter = and(gte(orders.createdAt, startAt), lt(orders.createdAt, endAt));

  const [sales, pendingProducts, pendingOffers, openSupply, pendingWd, lowStock, openTickets, sellerCount, totalOrders, posSales] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${orders.total}),0)::bigint`, n: count() }).from(orders).where(and(eq(orders.paymentStatus, "paid"), dateFilter)),
    db.select({ n: count() }).from(products).where(eq(products.status, "pending")),
    db.select({ n: count() }).from(sellers).where(eq(sellers.status, "pending")),
    db.select({ n: count() }).from(supplyRequests).where(sql`${supplyRequests.status} not in ('completed','cancelled','rejected')`),
    db.select({ n: count(), s: sql<number>`coalesce(sum(${withdrawals.amount}),0)::bigint` }).from(withdrawals).where(eq(withdrawals.status, "pending")),
    db.select({ n: count() }).from(products).where(sql`${products.source} = 'central' and ${products.status} = 'active' and (exists (select 1 from product_variants v where v.product_id = ${products.id} and v.is_active and (v.on_hand - v.reserved) * v.base_unit_amount <= ${products.lowStockThreshold}) or (not exists (select 1 from product_variants v where v.product_id = ${products.id} and v.is_active) and ${products.onHand} - ${products.reserved} <= ${products.lowStockThreshold}))`),
    db.select({ n: count() }).from(tickets).where(sql`${tickets.status} not in ('resolved','closed')`),
    db.select({ n: count() }).from(sellers).where(eq(sellers.status, "approved")),
    db.select({ n: count() }).from(orders).where(dateFilter),
    db.execute(sql`select coalesce(sum(total),0)::bigint value,count(*)::int n from (select total from central_pos_sales where status='completed' and created_at >= ${startAt} and created_at < ${endAt} union all select total from seller_pos_sales where status='completed' and created_at >= ${startAt} and created_at < ${endAt}) q`),
  ]);

  const [chartRows, topProductsRows, topSellersRows, recentOrders, recentCentralSales, recentSellerSales, recentTickets, newestSellers, recentWithdrawals, recentRequests, todaysCampaigns, smsFailures, gatewayFailures, mostViewedProducts] = await Promise.all([
    metric === "profit"
      ? db.execute(sql`select d, sum(value)::bigint as value from (select to_char(date_trunc(${interval}, o.created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD') d, sum((i.unit_price-i.unit_cost)*i.qty)::bigint value from orders o join order_items i on i.order_id=o.id where o.payment_status='paid' and o.created_at >= ${startAt} and o.created_at < ${endAt} and i.seller_id is null group by 1 union all select to_char(date_trunc(${interval}, s.created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD'), sum((i.unit_price-i.unit_cost)*i.quantity)::bigint from central_pos_sales s join central_pos_items i on i.sale_id=s.id where s.status='completed' and s.created_at >= ${startAt} and s.created_at < ${endAt} group by 1) q group by d order by d`)
      : metric === "orders"
        ? db.execute(sql`select d, count(*)::bigint as value from (select to_char(date_trunc(${interval}, created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD') d from orders where payment_status='paid' and created_at >= ${startAt} and created_at < ${endAt} union all select to_char(date_trunc(${interval}, created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD') from central_pos_sales where status='completed' and created_at >= ${startAt} and created_at < ${endAt} union all select to_char(date_trunc(${interval}, created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD') from seller_pos_sales where status='completed' and created_at >= ${startAt} and created_at < ${endAt}) q group by d order by d`)
        : db.execute(sql`select d, sum(value)::bigint as value from (select to_char(date_trunc(${interval}, created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD') d, total value from orders where payment_status='paid' and created_at >= ${startAt} and created_at < ${endAt} union all select to_char(date_trunc(${interval}, created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD'), total from central_pos_sales where status='completed' and created_at >= ${startAt} and created_at < ${endAt} union all select to_char(date_trunc(${interval}, created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD'), total from seller_pos_sales where status='completed' and created_at >= ${startAt} and created_at < ${endAt}) q group by d order by d`),
    db.execute(sql`select product_id as id, name, sum(qty)::int qty, sum(revenue)::bigint revenue from (select i.product_id, coalesce(p.name_fa,i.title) name, i.qty, i.line_total revenue from order_items i join orders o on o.id=i.order_id left join products p on p.id=i.product_id where o.payment_status='paid' and o.created_at >= ${startAt} and o.created_at < ${endAt} union all select i.product_id, coalesce(p.name_fa,i.title), i.quantity, i.line_total from central_pos_items i join central_pos_sales s on s.id=i.sale_id left join products p on p.id=i.product_id where s.status='completed' and s.created_at >= ${startAt} and s.created_at < ${endAt} union all select i.product_id, coalesce(p.name_fa,i.title), i.quantity, i.line_total from seller_pos_items i join seller_pos_sales s on s.id=i.sale_id left join products p on p.id=i.product_id where s.status='completed' and s.created_at >= ${startAt} and s.created_at < ${endAt}) q group by product_id,name order by qty desc,revenue desc limit 6`),
    db.execute(sql`select id,name,sum(orders)::int orders,sum(sales)::bigint sales from (select s.id,s.shop_name name,count(distinct o.id)::int orders,sum(i.line_total)::bigint sales from order_items i join orders o on o.id=i.order_id join sellers s on s.id=i.seller_id where o.payment_status='paid' and o.created_at >= ${startAt} and o.created_at < ${endAt} group by s.id,s.shop_name union all select s.id,s.shop_name,count(distinct o.id)::int,sum(i.line_total)::bigint from seller_pos_items i join seller_pos_sales o on o.id=i.sale_id join sellers s on s.id=o.seller_id where o.status='completed' and o.created_at >= ${startAt} and o.created_at < ${endAt} group by s.id,s.shop_name) q group by id,name order by sales desc limit 5`),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
    db.select().from(centralPosSales).orderBy(desc(centralPosSales.createdAt)).limit(4),
    db.select({ sale: sellerPosSales, shop: sellers.shopName }).from(sellerPosSales).leftJoin(sellers, eq(sellers.id, sellerPosSales.sellerId)).orderBy(desc(sellerPosSales.createdAt)).limit(4),
    db.select({ t: tickets, name: users.name }).from(tickets).leftJoin(users, eq(users.id, tickets.customerId)).orderBy(desc(tickets.createdAt)).limit(5),
    db.select({ s: sellers, name: users.name }).from(sellers).innerJoin(users, eq(users.id, sellers.userId)).orderBy(desc(sellers.createdAt)).limit(5),
    db.select({ w: withdrawals, shop: sellers.shopName }).from(withdrawals).innerJoin(sellers, eq(sellers.id, withdrawals.sellerId)).orderBy(desc(withdrawals.createdAt)).limit(5),
    db.select({ r: supplyRequests, name: users.name }).from(supplyRequests).leftJoin(users, eq(users.id, supplyRequests.customerId)).orderBy(desc(supplyRequests.createdAt)).limit(5),
    db.select().from(marketingCampaigns).where(and(eq(marketingCampaigns.status, "active"), sql`((${marketingCampaigns.scheduleAt} >= ${dayStart} and ${marketingCampaigns.scheduleAt} < ${tomorrow}) or ${marketingCampaigns.type} in ('birthday','welcome','purchase','review'))`)).orderBy(marketingCampaigns.scheduleAt).limit(6),
    db.select().from(smsLogs).where(eq(smsLogs.status, "failed")).orderBy(desc(smsLogs.createdAt)).limit(5),
    db.select().from(payments).where(and(eq(payments.method, "gateway"), sql`${payments.status} in ('failed','needs_refund')`)).orderBy(desc(payments.createdAt)).limit(5),
    db.select({ id: products.id, name: products.nameFa, slug: products.slug, views: count(productViewLogs.id) }).from(productViewLogs).innerJoin(products, eq(products.id, productViewLogs.productId)).groupBy(products.id).orderBy(desc(count(productViewLogs.id))).limit(10),
  ]);

  const chart = chartRows.rows as { d: string; value: number | string }[];
  const points: DashboardPoint[] = chart.map((r) => ({ label: String(r.d), value: Number(r.value) }));
  const pieRows = topProductsRows.rows as { id: number; name: string; qty: number; revenue: number | string }[];
  const pie: PieSlice[] = pieRows.map((r) => ({ label: r.name, value: Number(r.qty), detail: `${fa(r.qty)} عدد`, href: `/admin/products/${r.id}` }));
  const sellersRows = topSellersRows.rows as { id: number; name: string; orders: number; sales: number | string }[];
  const posTotals = posSales.rows[0] as { value: number|string; n: number };
  const latestPaid = Number(sales[0]?.total ?? 0) + Number(posTotals?.value ?? 0);
  const centralProfit = Number((await db.execute(sql`select coalesce((select sum((i.unit_price-i.unit_cost)*i.qty) from order_items i join orders o on o.id=i.order_id where o.payment_status='paid' and o.created_at >= ${startAt} and o.created_at < ${endAt} and i.seller_id is null),0)+coalesce((select sum((i.unit_price-i.unit_cost)*i.quantity) from central_pos_items i join central_pos_sales s on s.id=i.sale_id where s.status='completed' and s.created_at >= ${startAt} and s.created_at < ${endAt}),0) as value`)).rows[0]?.value ?? 0);
  const campaignRows = todaysCampaigns;
  const latestActivity = [
    ...recentOrders.map((o) => ({ id: `order-${o.id}`, number: o.number, createdAt: o.createdAt, total: o.total, status: o.status, href: `/orders/${o.id}`, kind: "سایت" })),
    ...recentCentralSales.map((o) => ({ id: `central-${o.id}`, number: o.number, createdAt: o.createdAt, total: o.total, status: o.status, href: `/admin/pos/invoice/${o.id}`, kind: "فروش حضوری" })),
    ...recentSellerSales.map(({ sale: o, shop }) => ({ id: `seller-${o.id}`, number: o.number, createdAt: o.createdAt, total: o.total, status: o.status, href: `/admin/pos/invoice/${o.id}?seller=1`, kind: shop ?? "فروشنده" })),
  ].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,7);
  return (
    <main className="space-y-6">
      {sp.denied && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">شما مجوز دسترسی به آن بخش را ندارید.</div>}
      <PageHeader title="داشبورد مدیریت" subtitle={`خوش آمدید ${u.name}؛ نمای زنده فروشگاه برای ${jdate(new Date(), true)}`} actions={<Link href="/admin/orders" className="btn-primary"><ShoppingBag className="size-4"/>مدیریت سفارش‌ها</Link>} />
      <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-800 p-5 text-white shadow-lg md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-emerald-100"><Activity className="size-4 text-lime-300"/>نمای کلی کسب‌وکار</div><h2 className="text-2xl font-black md:text-3xl">سلام {u.name.split(" ")[0]}، فروشگاه در یک نگاه</h2><p className="mt-2 text-sm text-emerald-100">وضعیت سفارش‌ها، عملکرد فروش و موارد نیازمند پیگیری را یکجا ببینید.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/15"><span className="text-emerald-100">بازه گزارش</span><b className="mr-2">{jdate(startAt)} تا {jdate(new Date(endAt.getTime()-1))}</b></div></div>
      </section>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Link href="/admin/orders" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="درآمد پرداخت‌شده" value={toman(latestPaid)} icon={TrendingUp} tone="green" hint={`${fa((sales[0]?.n ?? 0) + (posTotals?.n ?? 0))} فروش در بازه`} /></Link>
        <Link href="/admin/accounting" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="سود اقلام انبار مرکزی" value={toman(centralProfit)} icon={BadgeDollarSign} tone="violet" hint="قیمت فروش منهای بهای تمام‌شده" /></Link>
        <Link href="/admin/orders" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="سفارش‌ها و فاکتورهای بازه" value={fa((totalOrders[0]?.n ?? 0) + (posTotals?.n ?? 0))} icon={ShoppingBag} tone="blue" hint="شامل پرداخت‌نشده‌ها" /></Link>
        <Link href="/admin/marketplace" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="فروشندگان برتر" value={fa(sellersRows.length)} icon={Store} tone="yellow" hint={`${fa(sellerCount[0]?.n ?? 0)} فروشنده تأییدشده`} /></Link>
        <Link href="/admin/marketplace" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="فروشندگان در انتظار" value={fa(pendingOffers[0]?.n ?? 0)} icon={Package} tone="yellow" hint="درخواست عضویت" /></Link>
        <Link href="/admin/supply" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="درخواست‌های استعلام باز" value={fa(openSupply[0]?.n ?? 0)} icon={Search} tone="violet" /></Link>
        <Link href="/admin/marketplace?tab=withdrawals" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="درخواست برداشت باز" value={fa(pendingWd[0]?.n ?? 0)} icon={Wallet} tone="blue" hint={toman(Number(pendingWd[0]?.s ?? 0))} /></Link>
        <Link href="/admin/tickets" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><Stat label="تیکت‌های نیازمند پاسخ" value={fa(openTickets[0]?.n ?? 0)} icon={LifeBuoy} tone="red" /></Link>
      </section>

      <Card title="گزارش پیشرفته فروش" className="border-emerald-100" action={<span className="hidden text-xs text-slate-400 sm:block">گزارش بر اساس زمان تهران</span>}>
        <form className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-3 md:grid-cols-6" method="get">
          <label className="text-xs text-slate-500">از تاریخ<div className="mt-1"><JalaliDatePicker name="from" defaultValue={from}/></div></label>
          <label className="text-xs text-slate-500">تا تاریخ<div className="mt-1"><JalaliDatePicker name="to" defaultValue={to}/></div></label>
          <label className="text-xs text-slate-500">تجمیع نمودار<select name="interval" className="input mt-1" defaultValue={interval}><option value="day">روزانه</option><option value="week">هفتگی</option><option value="month">ماهانه</option></select></label>
          <label className="text-xs text-slate-500">شاخص<select name="metric" className="input mt-1" defaultValue={metric}><option value="revenue">درآمد پرداخت‌شده</option><option value="profit">سود انبار مرکزی</option><option value="orders">تعداد سفارش پرداخت‌شده</option></select></label>
          <div className="flex items-end gap-2"><button className="btn-primary flex-1"><ChartNoAxesCombined className="size-4"/>اعمال فیلتر</button><Link href="/admin" className="btn-ghost">پاک‌کردن</Link></div>
        </form>
        <DashboardCharts points={points} pie={pie} metric={metric} />
      </Card>

      <Card title="۱۰ محصول پربازدید" action={<span className="text-xs text-slate-400">از زمان فعال‌شدن ثبت بازدید</span>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{mostViewedProducts.map((product, index) => <Link key={product.id} href={`/admin/products/${product.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-emerald-200 hover:bg-emerald-50/50"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${index < 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}><Eye className="size-4"/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{product.name}</b><small className="text-slate-500">رتبه {fa(index + 1)} · {fa(product.views)} بازدید</small></span></Link>)}{!mostViewedProducts.length && <EmptyState text="هنوز بازدیدی برای محصولات ثبت نشده است."/>}</div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="فروشندگان برتر" className="xl:col-span-1" action={<Link href="/admin/marketplace" className="text-xs font-bold text-emerald-700">همه فروشندگان</Link>}>
          <div className="space-y-3">{sellersRows.map((x,i)=><Link key={x.id} href={`/admin/marketplace/sellers/${x.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-emerald-50"><span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black ${i===0?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600"}`}>{fa(i+1)}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{x.name}</b><small className="text-slate-400">{fa(x.orders)} سفارش</small></span><b className="text-xs text-emerald-800">{toman(Number(x.sales))}</b></Link>)}{!sellersRows.length&&<EmptyState text="هنوز فروشی از فروشندگان ثبت نشده است."/>}</div>
        </Card>
        <Card title="آخرین ثبت‌نام فروشندگان" action={<Link href="/admin/marketplace" className="text-xs font-bold text-emerald-700">مدیریت</Link>}>
          <div className="space-y-3">{newestSellers.map(({s,name})=><Link href={`/admin/marketplace/sellers/${s.id}`} key={s.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50"><span className="grid size-9 place-items-center rounded-full bg-violet-50 text-violet-700"><Store className="size-4"/></span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{s.shopName}</b><small className="text-slate-400">{name} · {jdate(s.createdAt,true)}</small></div><StatusBadge status={s.status}/></Link>)}{!newestSellers.length&&<EmptyState text="ثبت‌نامی وجود ندارد."/>}</div>
        </Card>
        <Card title="کمپین‌های امروز" action={<Link href="/admin/campaigns" className="text-xs font-bold text-emerald-700">همه کمپین‌ها</Link>}>
          <div className="space-y-3">{campaignRows.map((c)=><Link href={`/admin/campaigns?selected=${c.id}#campaign-${c.id}`} key={c.id} className="flex items-center gap-3 rounded-xl bg-amber-50/60 p-3 hover:bg-amber-100"><span className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><CalendarClock className="size-4"/></span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{c.name}</b><small className="text-slate-500">{c.scheduleAt?jdate(c.scheduleAt,true):"رویداد خودکار امروز"}</small></div><StatusBadge status={c.status}/></Link>)}{!campaignRows.length&&<EmptyState text="کمپین زمان‌بندی‌شده یا رویداد خودکار فعالی برای امروز نیست."/>}</div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="آخرین سفارش‌ها" action={<Link href="/admin/orders" className="text-xs font-bold text-emerald-700">مشاهده همه</Link>}>
          <div className="divide-y">{latestActivity.map((o)=><Link key={o.id} href={o.href} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-slate-50"><span className="min-w-0"><b dir="ltr" className="block">{o.number}</b><small className="text-slate-400">{o.kind} · {jdate(o.createdAt,true)}</small></span><span className="text-left"><b className="block">{toman(o.total)}</b><StatusBadge status={o.status} map={ORDER_STATUS}/></span></Link>)}</div>
        </Card>
        <Card title="آخرین تیکت‌ها" action={<Link href="/admin/tickets" className="text-xs font-bold text-emerald-700">صف تیکت‌ها</Link>}>
          <div className="divide-y">{recentTickets.map(({t,name})=><Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50"><span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><Ticket className="size-4"/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{t.subject}</b><small className="text-slate-400">{t.number} · {name??"مشتری"} · {jdate(t.createdAt,true)}</small></span><StatusBadge status={t.status}/></Link>)}</div>
        </Card>
        <Card title="درخواست‌های برداشت" action={<Link href="/admin/accounting" className="text-xs font-bold text-emerald-700">امور مالی</Link>}>
          <div className="divide-y">{recentWithdrawals.map(({w,shop})=><Link href={`/admin/marketplace?tab=withdrawals#withdrawal-${w.id}`} key={w.id} className="flex items-center gap-3 py-3 hover:bg-slate-50"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><ArrowDownToLine className="size-4"/></span><span className="min-w-0 flex-1"><b className="block text-sm">{shop}</b><small className="text-slate-400">{jdate(w.createdAt,true)}</small></span><span className="text-left"><b className="block text-sm">{toman(w.amount)}</b><StatusBadge status={w.status}/></span></Link>)}</div>
        </Card>
        <Card title="آخرین درخواست‌های استعلام" action={<Link href="/admin/supply" className="text-xs font-bold text-emerald-700">مدیریت استعلام‌ها</Link>}>
          <div className="divide-y">{recentRequests.map(({r,name})=><Link key={r.id} href={`/admin/supply/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><CircleHelp className="size-4"/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.partName||r.partNumber||r.number}</b><small className="text-slate-400">{r.number} · {name??"مشتری"} · {jdate(r.createdAt,true)}</small></span><StatusBadge status={r.status}/></Link>)}</div>
        </Card>
      </div>

      {(smsFailures.length>0||gatewayFailures.length>0) && <section className="grid gap-5 xl:grid-cols-2">
        {smsFailures.length>0&&<Card title={<span className="flex items-center gap-2 text-rose-700"><AlertTriangle className="size-4"/>خطاهای ارسال پیامک</span>} action={<Link href="/admin/sms" className="text-xs font-bold text-rose-700">بررسی پیامک‌ها</Link>}><div className="space-y-2">{smsFailures.map((x)=><Link href={`/admin/sms?log=${x.id}#sms-log-${x.id}`} key={x.id} className="block rounded-xl border border-rose-100 bg-rose-50/70 p-3 hover:bg-rose-100"><div className="flex justify-between gap-2 text-sm"><b>{x.event}</b><span dir="ltr">{x.phone}</span></div><p className="mt-1 line-clamp-2 text-xs text-rose-800">{x.response||x.body}</p><small className="text-rose-500">{jdate(x.createdAt,true)} · تلاش {fa(x.attempts)}</small></Link>)}</div></Card>}
        {gatewayFailures.length>0&&<Card title={<span className="flex items-center gap-2 text-rose-700"><AlertTriangle className="size-4"/>خطاهای درگاه پرداخت</span>} action={<Link href="/admin/orders?pay=failed" className="text-xs font-bold text-rose-700">بررسی سفارش‌ها</Link>}><div className="space-y-2">{gatewayFailures.map((x)=><Link href={x.orderId?`/admin/orders?order=${x.orderId}`:"/admin/orders?pay=failed"} key={x.id} className="block rounded-xl border border-rose-100 bg-rose-50/70 p-3 hover:bg-rose-100"><div className="flex justify-between gap-2 text-sm"><b>تراکنش #{fa(x.id)} · {x.gateway||"درگاه نامشخص"}</b><StatusBadge status={x.status}/></div><p className="mt-1 text-xs text-rose-800">{x.note||"پرداخت در درگاه تکمیل نشده است."}</p><small className="text-rose-500">{toman(x.amount)} · {jdate(x.createdAt,true)}</small></Link>)}</div></Card>}
      </section>}

      <div className="grid gap-5 xl:grid-cols-2">
        {u.permissions.includes("AUDIT_LOG_VIEW") ? <Card title="سلامت مالی و انبار"><IntegrityCheck/></Card> : <Card title="موارد نیازمند توجه"><div className="grid grid-cols-2 gap-3"><QuickLink href="/admin/products" icon={Boxes} title="محصولات در انتظار" value={pendingProducts[0]?.n??0}/><QuickLink href="/admin/marketplace" icon={Store} title="فروشندگان در انتظار" value={pendingOffers[0]?.n??0}/><QuickLink href="/admin/inventory" icon={AlertTriangle} title="هشدار موجودی کم" value={lowStock[0]?.n??0}/><QuickLink href="/admin/returns" icon={ArrowDownToLine} title="تیکت‌های باز" value={openTickets[0]?.n??0}/></div></Card>}
        <Card title="میانبرهای مدیریتی"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><QuickLink href="/admin/orders" icon={ShoppingBag} title="سفارش‌ها"/><QuickLink href="/admin/products" icon={Package} title="محصولات"/><QuickLink href="/admin/marketplace" icon={Store} title="فروشندگان"/><QuickLink href="/admin/tickets" icon={LifeBuoy} title="تیکت‌ها"/><QuickLink href="/admin/supply" icon={Search} title="استعلام‌ها"/><QuickLink href="/admin/accounting" icon={Wallet} title="امور مالی"/></div></Card>
      </div>
    </main>
  );
}

function EmptyState({text}:{text:string}) { return <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">{text}</p>; }
function QuickLink({href,icon:Icon,title,value}:{href:string;icon:typeof Package;title:string;value?:number}) { return <Link href={href} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="size-4"/></span><span className="min-w-0"><b className="block text-xs">{title}</b>{value!==undefined&&<small className="text-slate-400">{fa(value)} مورد</small>}</span><ArrowUpRight className="mr-auto size-4 text-slate-300"/></Link>; }
