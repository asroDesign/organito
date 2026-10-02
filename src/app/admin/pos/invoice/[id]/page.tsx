import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { centralPosItems, centralPosSales, sellerPosItems, sellerPosSales, sellers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PosInvoice } from "@/components/PosInvoice";
import { getSettings } from "@/lib/settings";
export default async function AdminPosInvoice({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{print?:string;seller?:string}>}){
 await requirePage({perm:"ORDERS_VIEW"});const {id}=await params;const sp=await searchParams;
 if(sp.seller==="1"){const [sale]=await db.select().from(sellerPosSales).where(eq(sellerPosSales.id,Number(id))).limit(1);if(!sale)notFound();const [seller]=await db.select({shopName:sellers.shopName}).from(sellers).where(eq(sellers.id,sale.sellerId));const items=await db.select().from(sellerPosItems).where(eq(sellerPosItems.saleId,sale.id));return <PosInvoice sale={sale} items={items} shop={seller?.shopName??"فروشگاه"} autoPrint={sp.print==="1"}/>}
 const [sale]=await db.select().from(centralPosSales).where(eq(centralPosSales.id,Number(id))).limit(1);if(!sale)notFound();const items=await db.select().from(centralPosItems).where(eq(centralPosItems.saleId,sale.id));
 const settings=await getSettings();return <PosInvoice sale={sale} items={items} shop={settings.siteName} autoPrint={sp.print==="1"}/>;
}
