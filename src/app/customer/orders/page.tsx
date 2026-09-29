import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { ORDER_STATUS, jdate, toman } from "@/lib/util";

export default async function MyOrders({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const u = await requirePage();
  const { s } = await searchParams;
  const all = await db.select().from(orders).where(eq(orders.customerId, u.id)).orderBy(desc(orders.createdAt));
  const groups: [string, string, string[]][] = [["", "همه", []], ["open", "در جریان", ["pending_payment", "paid", "processing", "shipped"]], ["done", "تحویل‌شده", ["completed"]], ["cancelled", "لغوشده", ["cancelled"]]];
  const g = groups.find((x) => x[0] === (s ?? "")) ?? groups[0];
  const list = g[2].length ? all.filter((o) => g[2].includes(o.status)) : all;
  return (
    <>
      <PageHeader title="سفارش‌های من" />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">{groups.map(([k, l, st]) => <Link key={k} href={k ? `?s=${k}` : "?"} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${g[0] === k ? "bg-emerald-600 font-bold text-white" : "text-slate-600"}`}>{l} ({(st.length ? all.filter((o) => st.includes(o.status)).length : all.length).toLocaleString("fa-IR")})</Link>)}</div>
      {list.length === 0 ? <Empty title="سفارشی در این بخش نیست" /> : (
        <div className="grid gap-3">
          {list.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div><b dir="ltr">{o.number}</b><div className="text-xs text-slate-500">{jdate(o.createdAt, true)}</div></div>
              <div className="text-sm"><span className="text-slate-500">مبلغ: </span><b>{toman(o.total)}</b>{o.discount > 0 && <span className="mr-2 text-xs text-rose-600">({toman(o.discount)} تخفیف)</span>}</div>
              <StatusBadge status={o.status} map={ORDER_STATUS} />
              <div className="flex gap-2"><Link href={`/customer/tracking?q=${o.number}`} className="btn-sm">پیگیری</Link><Link href={`/customer/orders/${o.id}`} className="btn-sm">جزئیات</Link></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
