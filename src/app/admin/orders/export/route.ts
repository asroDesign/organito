import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireApi } from "@/lib/auth";
import { ORDER_STATUS, jdate } from "@/lib/util";

const payLabels: Record<string, string> = { paid: "پرداخت‌شده", unpaid: "پرداخت‌نشده", refunded: "مسترد", pending_verification: "در انتظار تأیید" };
const kindLabels: Record<string, string> = { online: "فروش آنلاین", central: "فروش حضوری انبار مرکزی", seller: "فروش حضوری تأمین‌کننده" };

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireApi("ORDERS_VIEW");
  const params = new URL(request.url).searchParams;
  const filters = [sql`true`];
  const q = params.get("q")?.trim().slice(0, 150);
  const status = params.get("status")?.slice(0, 40);
  const pay = params.get("pay")?.slice(0, 40);
  const channel = params.get("channel")?.slice(0, 20);
  if (q) filters.push(sql`(number ilike ${`%${q}%`} or name ilike ${`%${q}%`} or phone ilike ${`%${q}%`})`);
  if (status) filters.push(sql`status=${status}`);
  if (pay) filters.push(sql`"paymentStatus"=${pay}`);
  if (channel) filters.push(sql`kind=${channel}`);
  const where = sql.join(filters, sql` and `);
  const sales = sql`select * from (
    select o.id,'online'::text kind,o.number,u.name,u.phone,'سفارش آنلاین'::text shop,o.created_at "createdAt",(o.total+o.credit_amount)::float8 total,o.status,o.payment_status "paymentStatus",'online'::text method from orders o join users u on u.id=o.customer_id
    union all select p.id,'central',p.number,p.customer_name,p.customer_phone,'انبار مرکزی',p.created_at,p.total::float8,p.status,case when p.status='returned' then 'refunded' else 'paid' end,p.payment_method from central_pos_sales p
    union all select p.id,'seller',p.number,p.customer_name,p.customer_phone,s.shop_name,p.created_at,p.total::float8,p.status,case when p.status='returned' then 'refunded' else 'paid' end,p.payment_method from seller_pos_sales p join sellers s on s.id=p.seller_id
  ) sales`;
  const result = await db.execute(sql`select * from (${sales}) filtered where ${where} order by "createdAt" desc,id desc,kind`);
  const rows = result.rows as { number: string; name: string; phone: string; kind: string; shop: string; createdAt: Date; total: number | string; status: string; paymentStatus: string; method: string }[];
  const lines = [
    ["شماره فاکتور", "نام مشتری", "موبایل", "نوع فروش", "فروشگاه", "تاریخ", "مبلغ (ریال)", "وضعیت سفارش", "وضعیت پرداخت", "روش پرداخت"].map(csvCell).join(","),
    ...rows.map((row) => [
      row.number,
      row.name,
      row.phone,
      kindLabels[row.kind] ?? row.kind,
      row.shop,
      jdate(row.createdAt, true),
      Math.round(Number(row.total)),
      ORDER_STATUS[row.status] ?? row.status,
      payLabels[row.paymentStatus] ?? row.paymentStatus,
      row.method === "mixed" ? "نقد و کارت" : row.method === "cash" ? "نقدی" : row.method === "card" ? "کارتخوان" : "آنلاین",
    ].map(csvCell).join(",")),
  ];
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=orders-and-invoices.csv",
      "Cache-Control": "private, no-store",
    },
  });
}
