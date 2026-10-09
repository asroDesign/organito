import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryWarehouseStock, inventoryWarehouses, products, productVariants, sellerOffers } from '@/db/schema';
import { HttpError } from '../util';
import type { DB } from '../types';

/** The central stock columns remain the source of truth; keep their warehouse projection present. */
export async function ensurePrimaryWarehouse(tx:DB){
 await tx.execute(sql`select pg_advisory_xact_lock(99127)`);
 let [warehouse]=await tx.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.isDefault,true)).for('update');
 if(!warehouse){
  [warehouse]=await tx.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.code,'MAIN')).for('update');
  if(warehouse)[warehouse]=await tx.update(inventoryWarehouses).set({name:'انبار مرکزی',enabled:true,isDefault:true,updatedAt:new Date()}).where(eq(inventoryWarehouses.id,warehouse.id)).returning();
  else [warehouse]=await tx.insert(inventoryWarehouses).values({name:'انبار مرکزی',code:'MAIN',enabled:true,isDefault:true}).returning();
  await tx.execute(sql`insert into inventory_warehouse_stock(warehouse_id,product_id,variant_id,on_hand,reserved)
   select ${warehouse.id},p.id,null,p.on_hand,p.reserved from products p
   where p.source='central' and p.status<>'deleted' and not exists(select 1 from product_variants v where v.product_id=p.id and v.is_active and v.deleted_at is null)
   on conflict(warehouse_id,product_id) where variant_id is null do update set on_hand=excluded.on_hand,reserved=excluded.reserved,updated_at=now()`);
  await tx.execute(sql`insert into inventory_warehouse_stock(warehouse_id,product_id,variant_id,on_hand,reserved)
   select ${warehouse.id},v.product_id,v.id,v.on_hand,v.reserved from product_variants v join products p on p.id=v.product_id
   where p.source='central' and p.status<>'deleted'
   on conflict(warehouse_id,variant_id) where variant_id is not null do update set on_hand=excluded.on_hand,reserved=excluded.reserved,updated_at=now()`);
 }
 return warehouse;
}

export type WarehouseStockRow={productId:number;variantId:number|null;label:string;sku:string;unit:string;onHand:number;reserved:number;unitCost:number};
export async function getWarehouseStock(warehouseId:number,query=''){
 const [warehouse]=await db.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id,warehouseId));
 if(!warehouse)throw new HttpError(404,'انبار پیدا نشد');
 const q=query.trim().slice(0,100), like=`%${q.replace(/[%_\\]/g,'\\$&')}%`;
 let rows:WarehouseStockRow[]=[];
 if(warehouse.sellerId){
  const offers=await db.select({offer:sellerOffers,product:products}).from(sellerOffers).innerJoin(products,eq(products.id,sellerOffers.productId)).where(and(eq(sellerOffers.sellerId,warehouse.sellerId),eq(sellerOffers.status,'approved'),sql`${products.status}<>'deleted'`,q?or(ilike(products.nameFa,like),ilike(products.sku,like)):undefined));
  const variantRows=await db.select({id:productVariants.productId}).from(productVariants).where(sql`${productVariants.deletedAt} is null`);
  const variantProducts=new Set(variantRows.map(v=>v.id));
  rows=offers.filter(({product})=>!variantProducts.has(product.id)).map(({offer,product})=>({productId:product.id,variantId:null,label:product.nameFa,sku:product.sku,unit:product.inventoryBaseUnit,onHand:offer.stock,reserved:offer.reserved,unitCost:offer.costPrice??product.avgCost}));
 }else if(warehouse.isDefault){
  const variants=await db.select({variant:productVariants,product:products}).from(productVariants).innerJoin(products,eq(products.id,productVariants.productId)).where(and(sql`${products.source}='central' and ${products.status}<>'deleted'`,sql`(${productVariants.deletedAt} is null or ${productVariants.onHand}<>0 or ${productVariants.reserved}<>0)`,q?or(ilike(products.nameFa,like),ilike(productVariants.title,like),ilike(productVariants.sku,like)):undefined));
  rows=variants.map(({variant,product})=>({productId:product.id,variantId:variant.id,label:`${product.nameFa} · ${variant.title}`,sku:variant.sku,unit:variant.inventoryUnit||product.inventoryBaseUnit,onHand:variant.onHand,reserved:variant.reserved,unitCost:variant.costPrice??product.avgCost}));
  const variantProducts=await db.select({id:productVariants.productId}).from(productVariants).where(sql`${productVariants.deletedAt} is null`);
  const ids=new Set(variantProducts.map(v=>v.id));
  const base=await db.select().from(products).where(and(sql`${products.source}='central' and ${products.status}<>'deleted'`,q?or(ilike(products.nameFa,like),ilike(products.sku,like)):undefined));
  rows.push(...base.filter(p=>!ids.has(p.id)).map(p=>({productId:p.id,variantId:null,label:p.nameFa,sku:p.sku,unit:p.inventoryBaseUnit,onHand:p.onHand,reserved:p.reserved,unitCost:p.avgCost})));
 }else{
  const stock=await db.select({stock:inventoryWarehouseStock,product:products,variant:productVariants}).from(inventoryWarehouseStock).innerJoin(products,eq(products.id,inventoryWarehouseStock.productId)).leftJoin(productVariants,eq(productVariants.id,inventoryWarehouseStock.variantId)).where(and(eq(inventoryWarehouseStock.warehouseId,warehouseId),sql`${products.status}<>'deleted'`,sql`(${inventoryWarehouseStock.onHand}<>0 or ${inventoryWarehouseStock.reserved}<>0)`,q?or(ilike(products.nameFa,like),ilike(products.sku,like),ilike(productVariants.title,like),ilike(productVariants.sku,like)):undefined));
  rows=stock.map(({stock:s,product,variant})=>({productId:product.id,variantId:s.variantId,label:product.nameFa+(variant?` · ${variant.title}`:''),sku:variant?.sku??product.sku,unit:variant?.inventoryUnit??product.inventoryBaseUnit,onHand:s.onHand,reserved:s.reserved,unitCost:variant?.costPrice??product.avgCost}));
 }
 return {warehouse,rows:rows.filter(r=>r.onHand!==0||r.reserved!==0).sort((a,b)=>a.label.localeCompare(b.label,'fa'))};
}
