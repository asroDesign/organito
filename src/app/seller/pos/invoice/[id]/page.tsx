import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerPosItems, sellerPosSales, sellers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PosInvoice } from "@/components/PosInvoice";
export default async function SellerPosInvoice({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{print?:string}>}){
 const user=await requirePage({role:"seller"});const {id}=await params;const [sale]=await db.select().from(sellerPosSales).where(and(eq(sellerPosSales.id,Number(id)),eq(sellerPosSales.sellerId,user.sellerId!))).limit(1);if(!sale)notFound();const [seller]=await db.select({shopName:sellers.shopName}).from(sellers).where(eq(sellers.id,sale.sellerId));const items=await db.select().from(sellerPosItems).where(and(eq(sellerPosItems.saleId,sale.id),eq(sellerPosItems.sellerId,user.sellerId!)));const sp=await searchParams;
 return <PosInvoice sale={sale} items={items} shop={seller?.shopName??"فروشگاه"} autoPrint={sp.print==="1"}/>;
}
