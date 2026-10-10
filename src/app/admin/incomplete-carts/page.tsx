import { and, desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { incompleteCarts } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { paginationParams } from "@/lib/pagination";
import { faNum, jdate, maskPhone } from "@/lib/util";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import { IncompleteCartActions } from "@/components/IncompleteCartActions";

export default async function IncompleteCarts({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string }> }) {
  await requirePage({ perm: "SMS_MANAGE" });
  const sp = await searchParams, q = (sp.q ?? "").trim().slice(0, 100);
  const filters = [sql`${incompleteCarts.status} <> 'completed'`];
  if (q) filters.push(or(ilike(incompleteCarts.phone, `%${q}%`), ilike(incompleteCarts.customerName, `%${q}%`), ilike(incompleteCarts.reason, `%${q}%`))!);
  const where = and(...filters);
  const [{ total = 0 } = {}] = await db.select({ total: sql<number>`count(*)::int` }).from(incompleteCarts).where(where);
  const { pageSize } = paginationParams(sp), page = Math.min(paginationParams(sp).page, Math.max(1, Math.ceil(total / pageSize)));
  // Select only the columns rendered here. This page does not depend on newer
  // analytics-link columns, so it remains available while older production DBs
  // finish applying their additive migrations.
  const entries = await db.select({
    id: incompleteCarts.id,
    customerName: incompleteCarts.customerName,
    phone: incompleteCarts.phone,
    items: incompleteCarts.items,
    reason: incompleteCarts.reason,
    status: incompleteCarts.status,
    lastSmsStatus: incompleteCarts.lastSmsStatus,
    updatedAt: incompleteCarts.updatedAt,
    discountCodeId: incompleteCarts.discountCodeId,
  }).from(incompleteCarts).where(where).orderBy(desc(incompleteCarts.updatedAt)).limit(pageSize).offset((page - 1) * pageSize);
  return <>
    <PageHeader title="سفارش‌ها و سبدهای ناقص" subtitle={`${faNum(total)} مورد نیازمند پیگیری · پیامک یادآوری و کد تخفیف از این بخش به درخواست مدیر ارسال می‌شود`} />
    <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="جستجوی نام، موبایل یا دلیل" className="input !w-72" /><button className="btn-primary">جستجو</button></form>
    <Table head={["مشتری", "سبد", "وضعیت", "آخرین فعالیت", "دلیل و پیگیری"]} empty={!entries.length}>
      {entries.map((cart) => <tr key={cart.id} className="align-top">
        <Td><b>{cart.customerName || "مشتری"}</b><div className="mt-1 text-xs text-slate-500" dir="ltr">{maskPhone(cart.phone ?? "")}</div></Td>
        <Td><div className="space-y-1 text-xs">{(Array.isArray(cart.items) ? cart.items : []).map((item, i) => <div key={`${item.productId}-${item.variantId ?? 0}-${i}`} className="max-w-64">{item.title || `محصول ${faNum(item.productId)}`} <b>× {faNum(item.qty)}</b></div>)}<div className="text-slate-400">{faNum(Array.isArray(cart.items) ? cart.items.length : 0)} ردیف کالا</div></div></Td>
        <Td><Badge tone={cart.status === "checkout_started" ? "yellow" : "blue"}>{cart.status === "checkout_started" ? "پرداخت آغاز شده" : "سبد رهاشده"}</Badge>{cart.lastSmsStatus && <div className="mt-1 text-[10px] text-slate-500">پیامک: {cart.lastSmsStatus === "sent" ? "ارسال شد" : cart.lastSmsStatus === "simulated" ? "شبیه‌سازی" : cart.lastSmsStatus === "partial" ? "ارسال بخشی موفق بود" : cart.lastSmsStatus === "failed" ? "ناموفق" : cart.lastSmsStatus}</div>}</Td>
        <Td className="whitespace-nowrap text-xs">{jdate(cart.updatedAt, true)}</Td>
        <Td><IncompleteCartActions id={cart.id} initialReason={cart.reason} />{cart.discountCodeId && <div className="mt-1 text-[10px] text-slate-400">کد تخفیف مرتبط: #{faNum(cart.discountCodeId)}</div>}</Td>
      </tr>)}
    </Table>
    <div className="mt-4"><Pagination page={page} pageSize={pageSize} total={total} /></div>
  </>;
}
