import { sql } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db";
import { requirePage } from "@/lib/auth";
import { Card, KV, PageHeader, Table, Td } from "@/components/ui";
import { faNum, jdate, toman } from "@/lib/util";

export default async function SellerFinance() {
  const u = await requirePage({ role: "seller" });
  const sid = u.sellerId!;
  const [sumR, byProduct, statements] = await Promise.all([
    db.execute(sql`select coalesce(sum(sh.items_total),0)::bigint gross, coalesce(sum(sh.shipping_cost),0)::bigint shipping, coalesce(sum(case when sh.settled then sh.commission else round(sh.items_total * s.commission_rate / 100.0) end),0)::bigint commission, coalesce(sum(sh.deductions),0)::bigint deductions, max(s.commission_rate) rate
      from seller_shipments sh join orders o on o.id = sh.order_id join sellers s on s.id = sh.seller_id where sh.seller_id = ${sid} and o.payment_status = 'paid' and sh.status <> 'cancelled'`),
    db.execute(sql`select oi.title, sum(oi.qty)::int qty, sum(oi.line_total)::bigint gross from order_items oi join seller_shipments sh on sh.id = oi.shipment_id join orders o on o.id = oi.order_id where oi.seller_id = ${sid} and o.payment_status='paid' and sh.status <> 'cancelled' group by 1 order by 3 desc`),
    db.execute(sql`select to_char(sh.created_at at time zone 'Asia/Tehran', 'YYYY-MM') period, count(*)::int n, sum(sh.items_total)::bigint gross, sum(sh.commission)::bigint commission, sum(case when sh.settled then 1 else 0 end)::int settled, max(sh.created_at) last
      from seller_shipments sh join orders o on o.id = sh.order_id where sh.seller_id = ${sid} and o.payment_status = 'paid' group by 1 order by 1 desc`),
  ]);
  const s = sumR.rows[0] as Record<string, string>;
  const net = Number(s.gross) + Number(s.shipping) - Number(s.commission) - Number(s.deductions);
  return (
    <>
      <PageHeader title="مالی و حسابداری فروشنده" actions={<a href="/api/seller/report.csv" className="btn-ghost"><Download className="h-4 w-4" />خروجی CSV</a>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="خلاصه مالی">
          <KV k="فروش ناخالص" v={toman(Number(s.gross))} /><KV k="هزینه ارسال دریافتی" v={toman(Number(s.shipping))} />
          <KV k={`کمیسیون (${faNum(s.rate ?? 0)}٪)`} v={`- ${toman(Number(s.commission))}`} /><KV k="کسورات" v={`- ${toman(Number(s.deductions))}`} />
          <div className="mt-2 border-t pt-2"><KV k="مبلغ خالص" v={<b className="text-emerald-600">{toman(net)}</b>} /></div>
        </Card>
        <div className="lg:col-span-2">
          <h3 className="mb-2 font-bold">گزارش فروش به تفکیک محصول</h3>
          <Table head={["محصول", "تعداد", "فروش ناخالص"]} empty={!byProduct.rows.length}>
            {(byProduct.rows as Record<string, string>[]).map((r) => <tr key={r.title}><Td>{r.title}</Td><Td>{faNum(r.qty)}</Td><Td>{toman(Number(r.gross))}</Td></tr>)}
          </Table>
        </div>
      </div>
      <h3 className="mb-2 mt-8 font-bold">صورت‌حساب دوره‌ای</h3>
      <Table head={["دوره", "تعداد مرسوله", "فروش", "کمیسیون کسرشده", "تسویه‌شده", "آخرین"]} empty={!statements.rows.length}>
        {(statements.rows as Record<string, string>[]).map((r) => <tr key={r.period}><Td>{r.period}</Td><Td>{faNum(r.n)}</Td><Td>{toman(Number(r.gross))}</Td><Td>{toman(Number(r.commission))}</Td><Td>{faNum(r.settled)}</Td><Td>{jdate(r.last)}</Td></tr>)}
      </Table>
    </>
  );
}
