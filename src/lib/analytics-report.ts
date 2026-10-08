import { sql } from "drizzle-orm";
import { db } from "@/db";

const dayInTehran = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const validDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));

export async function getAnalyticsReport(search: { from?: string; to?: string }) {
  const today = dayInTehran(new Date());
  const to = validDate(search.to) ? search.to! : today;
  const from = validDate(search.from) ? search.from! : new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const startAt = new Date(`${from}T00:00:00+03:30`);
  const endAt = new Date(Date.parse(`${to}T00:00:00Z`) + 86400000 - 12600000);
  const [funnelRows, sourceRows, dailyRows, productRows] = await Promise.all([
    db.execute(sql`with metrics as (
      select session_id,
        bool_or(event_type = 'page_view') as visited,
        bool_or(event_type = 'product_view') as viewed_product,
        bool_or(event_type = 'add_to_cart') as added_to_cart,
        bool_or(event_type = 'checkout_started') as checkout_started
      from analytics_events where created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()
      group by session_id
    )
    select
      (select count(*)::int from metrics where visited) as visits,
      (select count(*)::int from metrics where viewed_product) as product_views,
      (select count(*)::int from metrics where added_to_cart) as add_to_cart,
      (select count(*)::int from metrics where checkout_started) as checkouts,
      (select count(distinct analytics_session_id)::int from orders where payment_status = 'paid' and status <> 'cancelled' and analytics_session_id is not null and created_at >= ${startAt} and created_at < ${endAt}) as purchases,
      (select count(*)::int from analytics_events where event_type = 'page_view' and created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()) as page_views,
      (select count(*)::int from analytics_events where event_type = 'product_view' and created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()) as product_view_events,
      (select count(*)::int from analytics_events where event_type = 'add_to_cart' and created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()) as add_to_cart_events,
      (select count(*)::int from analytics_events where event_type = 'checkout_started' and created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()) as checkout_events,
      (select count(*)::int from orders where payment_status = 'paid' and status <> 'cancelled' and created_at >= ${startAt} and created_at < ${endAt}) as paid_orders`),
    db.execute(sql`with activity as (
      select session_id, coalesce(nullif(min(source), ''), 'direct') as source,
        bool_or(event_type = 'page_view') as visited,
        bool_or(event_type = 'product_view') as viewed_product,
        bool_or(event_type = 'add_to_cart') as added_to_cart,
        bool_or(event_type = 'checkout_started') as checkout_started
      from analytics_events where created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()
      group by session_id
    ), purchases as (
      select distinct analytics_session_id as session_id from orders
      where payment_status = 'paid' and status <> 'cancelled' and analytics_session_id is not null and created_at >= ${startAt} and created_at < ${endAt}
    )
    select a.source, count(*) filter (where a.visited)::int as visits,
      count(*) filter (where a.viewed_product)::int as product_views,
      count(*) filter (where a.added_to_cart)::int as add_to_cart,
      count(*) filter (where a.checkout_started)::int as checkouts,
      count(*) filter (where p.session_id is not null)::int as purchases
    from activity a left join purchases p using(session_id) group by a.source order by visits desc limit 12`),
    db.execute(sql`with funnel_events as (
      select to_char(date_trunc('day', created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD') as day, event_type, session_id
      from analytics_events where created_at >= ${startAt} and created_at < ${endAt} and expires_at > now()
      union all
      select to_char(date_trunc('day', created_at at time zone 'Asia/Tehran'), 'YYYY-MM-DD'), 'purchase', analytics_session_id
      from orders where payment_status = 'paid' and status <> 'cancelled' and analytics_session_id is not null and created_at >= ${startAt} and created_at < ${endAt}
    )
    select day, count(*) filter (where event_type = 'page_view')::int as visits,
      count(*) filter (where event_type = 'product_view')::int as product_views,
      count(*) filter (where event_type = 'add_to_cart')::int as add_to_cart,
      count(*) filter (where event_type = 'checkout_started')::int as checkouts,
      count(*) filter (where event_type = 'purchase')::int as purchases
    from funnel_events group by day order by day`),
    db.execute(sql`select e.product_id as id, coalesce(p.name_fa, 'محصول حذف‌شده') as name,
      count(*) filter (where e.event_type = 'product_view')::int as views,
      count(*) filter (where e.event_type = 'add_to_cart')::int as carts
    from analytics_events e left join products p on p.id = e.product_id
    where e.product_id is not null and e.event_type in ('product_view','add_to_cart') and e.created_at >= ${startAt} and e.created_at < ${endAt} and e.expires_at > now()
    group by e.product_id,p.name_fa order by carts desc,views desc limit 10`),
  ]);
  const funnel = funnelRows.rows[0] as Record<string, number | string> | undefined;
  return {
    from, to,
    funnel: { visits: Number(funnel?.visits ?? 0), productViews: Number(funnel?.product_views ?? 0), addToCart: Number(funnel?.add_to_cart ?? 0), checkouts: Number(funnel?.checkouts ?? 0), purchases: Number(funnel?.purchases ?? 0) },
    events: { pageViews: Number(funnel?.page_views ?? 0), productViews: Number(funnel?.product_view_events ?? 0), addToCart: Number(funnel?.add_to_cart_events ?? 0), checkouts: Number(funnel?.checkout_events ?? 0), paidOrders: Number(funnel?.paid_orders ?? 0) },
    sources: (sourceRows.rows as Record<string, unknown>[]).map((row) => ({ source: String(row.source ?? "direct"), visits: Number(row.visits ?? 0), productViews: Number(row.product_views ?? 0), addToCart: Number(row.add_to_cart ?? 0), checkouts: Number(row.checkouts ?? 0), purchases: Number(row.purchases ?? 0) })),
    daily: (dailyRows.rows as Record<string, unknown>[]).map((row) => ({ day: String(row.day), visits: Number(row.visits ?? 0), productViews: Number(row.product_views ?? 0), addToCart: Number(row.add_to_cart ?? 0), checkouts: Number(row.checkouts ?? 0), purchases: Number(row.purchases ?? 0) })),
    products: (productRows.rows as Record<string, unknown>[]).map((row) => ({ id: Number(row.id), name: String(row.name), views: Number(row.views ?? 0), carts: Number(row.carts ?? 0) })),
  };
}
