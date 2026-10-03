import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { categories, products, sellers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Img, PageHeader, StatusBadge, Table, Td, Badge } from "@/components/ui";
import { PRODUCT_STATUS, faNum, toman } from "@/lib/util";
import { Pagination } from "@/components/Pagination";
import { paginationParams } from "@/lib/pagination";
import { ProductViewLogButton } from "@/components/ProductViewLogButton";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string }> }) {
  const u = await requirePage({ perm: "PRODUCTS_VIEW" });
  const sp = await searchParams;
  const conds: SQL[] = [];
  if (sp.status) conds.push(eq(products.status, sp.status)); else conds.push(sql`${products.status} <> 'deleted'`);
  if (sp.q) conds.push(or(ilike(products.nameFa, `%${sp.q}%`), ilike(products.sku, `%${sp.q}%`), ilike(products.partNumber, `%${sp.q}%`))!);
  const [{ total = 0 } = {}] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(and(...conds));
  const { pageSize, offset } = paginationParams(sp);
  const page = Math.min(paginationParams(sp).page, Math.max(1, Math.ceil(total / pageSize)));
  const list = await db.select({ p: products, cat: categories.name, shop: sellers.shopName, offers: sql<number>`(select count(*) from seller_offers o where o.product_id = ${products.id})::int`, inventoryQty: sql<number>`case when exists(select 1 from product_variants v where v.product_id = ${products.id}) then (select coalesce(sum(v.on_hand * v.base_unit_amount),0)::int from product_variants v where v.product_id = ${products.id}) else ${products.onHand} end`, reservedQty: sql<number>`case when exists(select 1 from product_variants v where v.product_id = ${products.id}) then (select coalesce(sum(v.reserved * v.base_unit_amount),0)::int from product_variants v where v.product_id = ${products.id}) else ${products.reserved} end` })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId)).leftJoin(sellers, eq(sellers.id, products.ownerSellerId))
    .where(and(...conds)).orderBy(desc(products.updatedAt)).limit(pageSize).offset((page - 1) * pageSize);
  const statuses = Object.entries(PRODUCT_STATUS);
  return (
    <>
      <PageHeader title="محصولات و کاتالوگ" subtitle={`${faNum(total)} محصول`} actions={u.permissions.includes("PRODUCTS_CREATE") && <Link href="/admin/products/new" className="btn-primary"><Plus className="h-4 w-4" />افزودن محصول کامل</Link>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="نام، SKU یا کد محصول" className="input !w-64" />
        <select name="status" defaultValue={sp.status ?? ""} className="input !w-44"><option value="">همه وضعیت‌ها</option>{statuses.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-ghost">فیلتر</button>
        <Link href="/admin/products?status=pending" className="btn-ghost">صف بررسی</Link>
      </form>
      <Table head={["محصول", "SKU / PN", "منبع", "قیمت پایه", "موجودی مرکزی", "پیشنهادها", "وضعیت", ""]} empty={!list.length}>
        {list.map(({ p, cat, shop, offers, inventoryQty, reservedQty }) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <Td><div className="flex items-center gap-3"><Img id={p.mainImageId} alt="" className="h-11 w-11 rounded-lg" /><div><b>{p.nameFa}</b><div className="text-xs text-slate-500">{p.brand} · {cat}</div></div></div></Td>
            <Td><div dir="ltr" className="text-xs">{p.sku}<br />{p.partNumber}</div></Td>
            <Td>{p.source === "central" ? <Badge tone="blue">انبار مرکزی</Badge> : <Badge tone="violet">{shop ?? "Marketplace"}</Badge>}</Td>
            <Td>{toman(p.basePrice)}</Td>
            <Td>{p.source === "central" ? <span className={inventoryQty - reservedQty <= p.lowStockThreshold ? "font-bold text-rose-600" : ""}>{faNum(inventoryQty)} {p.inventoryBaseUnit} <span className="text-xs text-slate-400">(رزرو {faNum(reservedQty)})</span></span> : "—"}</Td>
            <Td>{faNum(offers)}</Td>
            <Td><StatusBadge status={p.status} map={PRODUCT_STATUS} /></Td>
            <Td><div className="flex flex-wrap gap-1"><Link href={`/admin/products/${p.id}`} className="btn-sm">جزئیات</Link><ProductViewLogButton productId={p.id} productName={p.nameFa}/>{u.permissions.includes("PRODUCTS_EDIT") && <Link href={`/admin/products/${p.id}/edit`} className="btn-sm">ویرایش</Link>}</div></Td>
          </tr>
        ))}
      </Table>
      <div className="mt-4"><Pagination page={page} pageSize={pageSize} total={total} /></div>
    </>
  );
}
