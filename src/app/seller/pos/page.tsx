import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, sellerOffers, sellerPosSales } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, Table, Td } from "@/components/ui";
import { faNum, jdate, toman } from "@/lib/util";
import PosClient from "@/components/SellerPosClient";

export default async function SellerPosPage() {
  const u = await requirePage({ role: "seller" });
  const offers = await db.select({ offerId: sellerOffers.id, productId: products.id, name: products.nameFa, brand: products.brand, sku: products.sku, price: sellerOffers.salePrice, basePrice: sellerOffers.price, stock: sellerOffers.stock, reserved: sellerOffers.reserved })
    .from(sellerOffers).innerJoin(products, eq(products.id, sellerOffers.productId))
    .where(sql`${sellerOffers.sellerId} = ${u.sellerId!} and ${sellerOffers.status} = 'approved' and ${products.status} = 'active'`);
  const available = offers.filter((x) => x.stock > x.reserved && (x.price ?? x.basePrice) > 0).map((x) => ({ offerId: x.offerId, productId: x.productId, name: x.name, brand: x.brand, sku: x.sku, price: x.price ?? x.basePrice, stock: x.stock - x.reserved }));
  const recent = await db.select({ sale: sellerPosSales, itemCount: sql<number>`(select coalesce(sum(quantity),0)::int from seller_pos_items where sale_id = ${sellerPosSales.id})` }).from(sellerPosSales).where(eq(sellerPosSales.sellerId, u.sellerId!)).orderBy(desc(sellerPosSales.createdAt)).limit(12);
  return <>
    <PageHeader title="فروش حضوری" subtitle="فاکتور صندوق، تسویه نقد یا کارت و کسر مستقیم از موجودی آزاد انبار شما" />
    {u.sellerStatus === "approved" ? <PosClient products={available} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">ثبت فروش پس از تأیید حساب تأمین‌کننده در دسترس خواهد بود.</div>}
    <section className="mt-8"><h2 className="mb-3 text-lg font-black">آخرین فروش‌های حضوری</h2>{recent.length ? <Table head={["فاکتور", "تاریخ", "مشتری", "اقلام", "مبلغ", "کمیسیون"]}>{recent.map(({sale,itemCount}) => <tr key={sale.id}><Td><b dir="ltr">{sale.number}</b></Td><Td>{jdate(sale.createdAt, true)}</Td><Td>{sale.customerName}<small className="block text-slate-500" dir="ltr">{sale.customerPhone}</small></Td><Td>{faNum(itemCount)}</Td><Td>{toman(sale.total)}</Td><Td className="font-bold text-emerald-700">۰ تومان</Td></tr>)}</Table> : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">هنوز فروش حضوری ثبت نشده است.</p>}</section>
  </>;
}
