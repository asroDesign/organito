import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePage } from "@/lib/auth";
import { paginationParams } from "@/lib/pagination";
import { PageHeader, Table, Td, Img } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import { PriceEditor } from "@/components/PriceEditor";
import { faNum } from "@/lib/util";

type PriceRow = { product_id: number; variant_id: number | null; name_fa: string; sku: string; variant_title: string | null; cost_price: number | string; price: number | string; sale_price: number | string; image_id: number | null };

export default async function ProductPrices({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string }> }) {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const needle = `%${q}%`;
  const rowsSql = sql`(
    SELECT p.id AS product_id, NULL::int AS variant_id, p.name_fa, p.sku, NULL::text AS variant_title,
      p.avg_cost AS cost_price, p.base_price AS price, p.compare_at_price AS sale_price, p.main_image_id AS image_id
    FROM products p WHERE p.status <> 'deleted' AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.is_active)
    UNION ALL
    SELECT p.id AS product_id, v.id AS variant_id, p.name_fa, v.sku, v.title AS variant_title,
      v.cost_price, v.price, v.compare_at_price AS sale_price, p.main_image_id AS image_id
    FROM products p JOIN product_variants v ON v.product_id=p.id AND v.is_active WHERE p.status <> 'deleted'
  ) prices`;
  const filter = q ? sql`WHERE name_fa ILIKE ${needle} OR sku ILIKE ${needle} OR coalesce(variant_title,'') ILIKE ${needle}` : sql``;
  const [{ total = 0 } = {}] = (await db.execute(sql`SELECT count(*)::int AS total FROM ${rowsSql} ${filter}`)).rows as { total: number }[];
  const { pageSize } = paginationParams(sp);
  const page = Math.min(paginationParams(sp).page, Math.max(1, Math.ceil(total / pageSize)));
  const result = await db.execute(sql`SELECT product_id, variant_id, name_fa, sku, variant_title, cost_price, price, sale_price, image_id FROM ${rowsSql} ${filter} ORDER BY name_fa, variant_id NULLS FIRST, product_id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
  const rows = result.rows as PriceRow[];
  return <>
    <PageHeader title="ویرایش سریع قیمت محصولات" subtitle={`${faNum(total)} محصول و تنوع · قیمت‌ها برای هر ردیف جداگانه ذخیره می‌شوند`} />
    <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-6 text-emerald-900">هزینه خرید و قیمت قبل از تخفیف از اطلاعات محصول خوانده می‌شوند؛ قیمت فروش برای هر تنوع مستقل است. با جستجوی نام یا SKU، ردیف موردنظر را سریع پیدا کنید.</div>
    <form className="mb-4 flex flex-wrap gap-2" action="/admin/product-prices"><input className="input !w-72" name="q" defaultValue={q} placeholder="جستجوی نام محصول یا SKU" /><input type="hidden" name="page" value="1" /><button className="btn-primary">جستجو</button>{q && <Link className="btn-ghost" href="/admin/product-prices">پاک‌کردن</Link>}</form>
    <Table head={["محصول / تنوع", "SKU", "ویرایش قیمت‌ها"]} empty={!rows.length}>
      {rows.map((r) => <tr key={`${r.product_id}:${r.variant_id ?? 0}`} className="align-top hover:bg-slate-50">
        <Td><div className="flex min-w-52 items-center gap-3"><Img id={r.image_id} alt="" className="h-11 w-11 rounded-lg" /><div><b>{r.name_fa}</b>{r.variant_title && <div className="text-xs text-emerald-700">{r.variant_title}</div>}</div></div></Td>
        <Td><span dir="ltr" className="font-mono text-xs">{r.sku}</span></Td>
        <Td><PriceEditor productId={Number(r.product_id)} variantId={r.variant_id === null ? null : Number(r.variant_id)} cost={Number(r.cost_price)} price={Number(r.price)} sale={Number(r.sale_price)} /></Td>
      </tr>)}
    </Table>
    <div className="mt-4"><Pagination page={page} pageSize={pageSize} total={total} /></div>
  </>;
}
