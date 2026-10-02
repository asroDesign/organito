import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { centralPosSales, products, productVariants } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, Table, Td } from "@/components/ui";
import { faNum, jdate, toman } from "@/lib/util";
import PosClient from "@/components/SellerPosClient";
import { InvoiceButton } from "@/components/InvoiceModal";

export default async function CentralPosPage(){
 await requirePage({perm:"INVENTORY_MANAGE"});
 const rows=await db.select({variant:productVariants,product:products,lastCost:sql<number>`coalesce(${productVariants.costPrice},(select sm.unit_cost from stock_movements sm where sm.variant_id=${productVariants.id} and sm.type in ('purchase_in','repack_in') order by sm.created_at desc, sm.id desc limit 1),${products.avgCost},0)`}).from(productVariants).innerJoin(products,eq(products.id,productVariants.productId)).where(and(eq(productVariants.isActive,true),eq(productVariants.isSellable,true),eq(products.source,"central"),eq(products.status,"active"))).orderBy(products.nameFa);
 const productsForPos=rows.filter(x=>x.variant.onHand>x.variant.reserved&&(x.variant.price??x.product.basePrice)>0).map(({variant,product,lastCost})=>({offerId:variant.id,productId:product.id,name:product.nameFa,brand:product.brand,sku:variant.sku,price:variant.price??product.basePrice,cost:Number(lastCost),stock:variant.onHand-variant.reserved}));
 const recent=await db.select({sale:centralPosSales,itemCount:sql<number>`(select coalesce(sum(quantity),0)::int from central_pos_items where sale_id=${centralPosSales.id})`}).from(centralPosSales).orderBy(desc(centralPosSales.createdAt)).limit(12);
 return <><PageHeader title="فروش حضوری انبار مرکزی" subtitle="ثبت فاکتور نقدی یا کارتی، کسر موجودی آزاد و ثبت خودکار سند حسابداری"/><PosClient products={productsForPos} endpoint="/api/admin/pos" central/><section className="mt-8"><h2 className="mb-3 text-lg font-black">آخرین فروش‌های حضوری</h2>{recent.length?<Table head={["فاکتور","تاریخ","مشتری","اقلام","مبلغ","جزئیات"]}>{recent.map(({sale,itemCount})=><tr key={sale.id}><Td><b dir="ltr">{sale.number}</b></Td><Td>{jdate(sale.createdAt,true)}</Td><Td>{sale.customerName}<small className="block text-slate-500" dir="ltr">{sale.customerPhone}</small></Td><Td>{faNum(itemCount)}</Td><Td><b>{toman(sale.total)}</b>{sale.discount>0&&<small className="block text-rose-600">تخفیف: {toman(sale.discount)}</small>}</Td><Td><InvoiceButton src={`/print/pos/central/${sale.id}`}/></Td></tr>)}</Table>:<p className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">هنوز فروش حضوری ثبت نشده است.</p>}</section></>;
}
