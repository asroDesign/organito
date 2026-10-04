import { notFound } from 'next/navigation';
import { and,eq } from 'drizzle-orm';
import { db } from '@/db';
import { centralPosItems,centralPosSales,sellerPosItems,sellerPosSales,sellers,posTerminals } from '@/db/schema';
import { requirePage } from '@/lib/auth';
import { PosInvoice } from '@/components/PosInvoice';
import { getSettings } from '@/lib/settings';
export default async function Invoice({params}:{params:Promise<{kind:string;id:string}>}){
 const settings=await getSettings();const u=await requirePage();const {kind,id:raw}=await params;const id=Number(raw);if(!Number.isSafeInteger(id)||id<1||!['central','seller'].includes(kind))notFound();
 const staff=u.staff&&(u.permissions.includes('ORDERS_VIEW')||u.permissions.includes('INVENTORY_MANAGE'));
 if(kind==='central'){if(!staff)notFound();const [sale]=await db.select().from(centralPosSales).where(eq(centralPosSales.id,id));if(!sale)notFound();const items=await db.select().from(centralPosItems).where(eq(centralPosItems.saleId,id));const [terminal]=sale.terminalId?await db.select().from(posTerminals).where(eq(posTerminals.id,sale.terminalId)):[];return <PosInvoice sale={sale} items={items} shop={settings.siteName} terminal={terminal?.name} labelHref={sale.shippingAddress?`/print/pos-label/${sale.id}`:undefined} design={settings} embedded/>}
 if(!staff&&!u.sellerId)notFound();const [sale]=await db.select().from(sellerPosSales).where(and(eq(sellerPosSales.id,id),staff?undefined:eq(sellerPosSales.sellerId,u.sellerId!)));if(!sale)notFound();const [shop]=await db.select().from(sellers).where(eq(sellers.id,sale.sellerId));const items=await db.select().from(sellerPosItems).where(eq(sellerPosItems.saleId,id));const [terminal]=sale.terminalId?await db.select().from(posTerminals).where(eq(posTerminals.id,sale.terminalId)):[];return <PosInvoice sale={sale} items={items} shop={shop.shopName} terminal={terminal?.name} design={settings} embedded/>;
}
