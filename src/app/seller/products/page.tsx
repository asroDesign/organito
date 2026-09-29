import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { products, sellerOffers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, Img, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { OfferEditor } from "@/components/OfferEditor";
import { OFFER_STATUS, PRODUCT_STATUS, faNum, toman } from "@/lib/util";

export default async function SellerProducts() {
  const u = await requirePage({ role: "seller" });
  const sid = u.sellerId!;
  const mine = await db.select().from(products).where(and(eq(products.ownerSellerId, sid), ne(products.status, "deleted"))).orderBy(desc(products.updatedAt));
  const offers = await db.select({ o: sellerOffers, p: products }).from(sellerOffers).innerJoin(products, eq(products.id, sellerOffers.productId)).where(eq(sellerOffers.sellerId, sid)).orderBy(desc(sellerOffers.updatedAt));
  const catalog = await db.select({ id: products.id, nameFa: products.nameFa, sku: products.sku }).from(products)
    .where(and(eq(products.status, "active"), sql`not exists (select 1 from seller_offers o where o.product_id = ${products.id} and o.seller_id = ${sid})`));
  return (
    <>
      <PageHeader title="محصولات و پیشنهادهای فروش" actions={<Link href="/seller/products/new" className="btn-primary"><Plus className="h-4 w-4" />تعریف محصول جدید</Link>} />
      <h2 className="mb-3 text-lg font-extrabold">پیشنهادهای فروش من</h2>
      <Table head={["محصول", "قیمت", "موجودی / رزرو / آزاد", "ارسال", "آماده‌سازی", "وضعیت", "اقدامات"]} empty={!offers.length}>
        {offers.map(({ o, p }) => (
          <tr key={o.id} className="align-top">
            <Td><div className="flex items-center gap-2"><Img id={p.mainImageId} alt="" className="h-10 w-10 rounded-lg" /><div><b>{p.nameFa}</b><div className="text-xs text-slate-500"><StatusBadge status={p.status} map={PRODUCT_STATUS} /></div></div></div></Td>
            <Td>{toman(o.salePrice ?? o.price)}</Td><Td>{faNum(o.stock)} / {faNum(o.reserved)} / <b>{faNum(o.stock - o.reserved)}</b></Td><Td>{toman(o.shippingCost)}</Td><Td>{faNum(o.prepDays)} روز</Td>
            <Td><StatusBadge status={o.status} map={OFFER_STATUS} />{o.isBuyBox && <div className="mt-1 text-[10px] text-orange-600">Buy Box</div>}</Td>
            <Td><div className="flex flex-wrap gap-1">
              {o.status === "approved" && <ActionButton url={`/api/seller/offers/${o.id}/status`} data={{ status: "inactive" }} className="btn-sm">غیرفعال</ActionButton>}
              {o.status === "inactive" && <ActionButton url={`/api/seller/offers/${o.id}/status`} data={{ status: "approved" }} className="btn-sm">فعال‌سازی</ActionButton>}
              <OfferEditor productId={p.id} initial={{ price: o.price, salePrice: o.salePrice, stock: o.stock, shippingCost: o.shippingCost, prepDays: o.prepDays, warranty: o.warranty, shipCity: o.shipCity }} label="ویرایش" />
              <ActionButton url="/api/seller/offers" data={{ productId: p.id, price: o.price, salePrice: o.salePrice, stock: o.reserved, shippingCost: o.shippingCost, prepDays: o.prepDays, warranty: o.warranty, shipCity: o.shipCity, condition: o.condition }} confirm="موجودی آزاد صفر شود (اعلام ناموجودی)؟" className="btn-sm">اعلام ناموجودی</ActionButton>
            </div></Td>
          </tr>
        ))}
      </Table>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="محصولات تعریف‌شده توسط من">
          {mine.length === 0 ? <p className="text-sm text-slate-500">هنوز محصولی تعریف نکرده‌اید.</p> : (
            <div className="divide-y">{mine.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div><b>{p.nameFa}</b> <StatusBadge status={p.status} map={PRODUCT_STATUS} />{p.rejectReason && <div className="text-xs text-rose-600">دلیل رد: {p.rejectReason}</div>}</div>
                <div className="flex gap-1"><Link href={`/seller/products/${p.id}/edit`} className="btn-sm">ویرایش</Link>
                  {["draft", "rejected"].includes(p.status) && <ActionButton url={`/api/products/${p.id}/status`} data={{ status: "pending" }} className="btn-sm">ارسال برای بررسی</ActionButton>}
                  {p.status !== "active" && <ActionButton url={`/api/products/${p.id}/status`} data={{ status: "deleted" }} confirm="حذف؟" className="btn-sm">حذف</ActionButton>}</div>
              </div>
            ))}</div>
          )}
        </Card>
        <Card title="فروش محصولات موجود در کاتالوگ">
          <p className="mb-3 text-xs text-slate-500">روی محصولات فعال کاتالوگ، پیشنهاد قیمت خود را ثبت کنید. پیشنهاد جدید پس از تأیید مدیر نمایش داده می‌شود.</p>
          <div className="max-h-96 divide-y overflow-y-auto">{catalog.map((c) => <div key={c.id} className="flex items-center justify-between py-2 text-sm"><span>{c.nameFa} <span className="text-xs text-slate-400" dir="ltr">{c.sku}</span></span><OfferEditor productId={c.id} label="ثبت پیشنهاد" /></div>)}</div>
        </Card>
      </div>
    </>
  );
}
