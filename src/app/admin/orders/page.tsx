import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requirePage } from '@/lib/auth';
import { PageHeader, StatusBadge, Table, Td } from '@/components/ui';
import { InvoiceButton } from '@/components/InvoiceModal';
import { ORDER_STATUS, jdate, toman } from '@/lib/util';
import { Pagination } from '@/components/Pagination';
import { paginationParams } from '@/lib/pagination';

type Sale = { id: number; kind: string; number: string; name: string; phone: string; shop: string; createdAt: Date; total: number; status: string; paymentStatus: string; method: string };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; pay?: string; channel?: string; page?: string; pageSize?: string }> }) {
  await requirePage({ perm: 'ORDERS_VIEW' });
  const sp = await searchParams;
  const filter = [sql`true`];
  if (sp.q) filter.push(sql`(number ilike ${'%' + sp.q + '%'} or name ilike ${'%' + sp.q + '%'} or phone ilike ${'%' + sp.q + '%'})`);
  if (sp.status) filter.push(sql`status=${sp.status}`);
  if (sp.pay) filter.push(sql`"paymentStatus"=${sp.pay}`);
  if (sp.channel) filter.push(sql`kind=${sp.channel}`);
  const sales = sql`select * from (
    select o.id,'online'::text kind,o.number,u.name,u.phone,'سفارش آنلاین'::text shop,o.created_at "createdAt",(o.total+o.credit_amount)::float8 total,o.status,o.payment_status "paymentStatus",'online'::text method from orders o join users u on u.id=o.customer_id
    union all select p.id,'central',p.number,p.customer_name,p.customer_phone,'انبار مرکزی',p.created_at,p.total::float8,p.status,case when p.status='returned' then 'refunded' else 'paid' end,p.payment_method from central_pos_sales p
    union all select p.id,'seller',p.number,p.customer_name,p.customer_phone,s.shop_name,p.created_at,p.total::float8,p.status,case when p.status='returned' then 'refunded' else 'paid' end,p.payment_method from seller_pos_sales p join sellers s on s.id=p.seller_id
  ) sales`;
  const where = sql.join(filter, sql` and `);
  const countResult = await db.execute(sql`select count(*)::int as total from (${sales}) filtered where ${where}`);
  const total = Number((countResult.rows[0] as { total?: number } | undefined)?.total ?? 0);
  const { page: requestedPage, pageSize } = paginationParams(sp);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const result = await db.execute(sql`select * from (${sales}) filtered where ${where} order by "createdAt" desc,id desc,kind limit ${pageSize} offset ${(page - 1) * pageSize}`);
  const list = result.rows as Sale[];
  const statuses = { ...ORDER_STATUS, returned: 'مرجوع‌شده' };
  return <>
    <PageHeader title="سفارش‌ها و فاکتورها" subtitle="فروش آنلاین و حضوری مرکزی و تأمین‌کنندگان، به ترتیب تاریخ" />
    <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="شماره، نام مشتری یا موبایل" className="input !w-60"/><select name="channel" defaultValue={sp.channel ?? ''} className="input !w-48"><option value="">همه کانال‌ها</option><option value="online">آنلاین</option><option value="central">حضوری مرکزی</option><option value="seller">حضوری تأمین‌کننده</option></select><select name="status" defaultValue={sp.status ?? ''} className="input !w-44"><option value="">همه وضعیت‌ها</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select name="pay" defaultValue={sp.pay ?? ''} className="input !w-44"><option value="">همه پرداخت‌ها</option><option value="paid">پرداخت‌شده</option><option value="unpaid">پرداخت‌نشده</option><option value="pending_verification">در انتظار تأیید</option><option value="refunded">مسترد</option></select><button className="btn-ghost">فیلتر</button></form>
    <Table head={['شماره','مشتری','نوع فروش / فروشگاه','تاریخ','مبلغ','وضعیت','پرداخت','']} empty={!list.length}>{list.map(s=><tr key={`${s.kind}:${s.id}`} className="hover:bg-slate-50"><Td><b dir="ltr">{s.number}</b></Td><Td>{s.name}<small dir="ltr" className="block text-slate-500">{s.phone}</small></Td><Td><span className="text-xs">{s.kind==='online'?'آنلاین':s.kind==='central'?'حضوری مرکزی':'حضوری تأمین‌کننده'}</span><small className="block text-slate-400">{s.shop}</small></Td><Td>{jdate(s.createdAt,true)}</Td><Td>{toman(s.total)}</Td><Td><StatusBadge status={s.status} map={statuses}/></Td><Td><StatusBadge status={s.paymentStatus} map={{paid:'پرداخت‌شده',unpaid:'پرداخت‌نشده',refunded:'مسترد',pending_verification:'در انتظار تأیید'}}/>{s.kind!=='online'&&<small className="mt-1 block text-slate-500">{s.method==='mixed'?'نقد + پوز':s.method==='cash'?'نقدی':'پوز'}</small>}</Td><Td><div className="flex gap-1">{s.kind==='online'?<><Link className="btn-sm" href={`/orders/${s.id}`}>جزئیات</Link><InvoiceButton src={`/print/order/${s.id}`}/></>:<InvoiceButton src={`/print/pos/${s.kind}/${s.id}`}/>}</div></Td></tr>)}</Table>
    <div className="mt-4"><Pagination page={page} pageSize={pageSize} total={total}/></div>
  </>;
}
