import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryDocuments, users } from '@/db/schema';
import { requireApi } from '../auth';
import { body, idParam, type Route } from './router';
import { acceptInventoryTransfer, createInventoryDocument } from '../services/inventory-documents';
import { getWarehouseStock } from '../services/warehouse-stock-report';
import { createXlsx } from '../xlsx';
import { HttpError, int } from '../util';

export const inventoryDocumentRoutes:Route[]=[
  {method:'GET',pattern:'admin/inventory/warehouses/:id/stock.xlsx',handler:async(req,p)=>{
    await requireApi('INVENTORY_MANAGE');
    const id=idParam(p.id),q=new URL(req.url).searchParams.get('q')??'';
    const {warehouse,rows}=await getWarehouseStock(id,q);
    const workbook=createXlsx('موجودی انبار',[['کالا / تنوع','شناسه کالا','کد کالا','واحد','موجودی','رزرو','آزاد','بهای واحد'],...rows.map(r=>[r.label,r.productId,r.sku,r.unit,r.onHand,r.reserved,r.onHand-r.reserved,r.unitCost])]);
    const code=warehouse.code.replace(/[^A-Za-z0-9_-]/g,'-');
    return new Response(workbook,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="inventory-${code}.xlsx"; filename*=UTF-8''inventory-${code}.xlsx`,'Cache-Control':'private, no-store'}});
  }},
  {method:'GET',pattern:'admin/inventory/documents',handler:async(req)=>{
    await requireApi('INVENTORY_MANAGE');
    const sp=new URL(req.url).searchParams,q=(sp.get('q')??'').trim().slice(0,120),mode=sp.get('mode'),status=sp.get('status');
    const page=int(sp.get('page')||1,1,1000000),pageSize=20;
    const where=and(mode==='transfers'?eq(inventoryDocuments.type,'transfer'):sql`${inventoryDocuments.type}<>'transfer'`,status&&status!=='all'?eq(inventoryDocuments.status,status):undefined,q?or(ilike(inventoryDocuments.number,`%${q}%`),ilike(inventoryDocuments.invoiceNumber,`%${q}%`),ilike(inventoryDocuments.partyName,`%${q}%`),ilike(inventoryDocuments.responsibleName,`%${q}%`)):undefined);
    const [count]=await db.select({n:sql<number>`count(*)::int`}).from(inventoryDocuments).where(where);
    const rows=await db.select().from(inventoryDocuments).where(where).orderBy(desc(inventoryDocuments.createdAt),desc(inventoryDocuments.id)).limit(pageSize).offset((page-1)*pageSize);
    return {rows,total:count.n,page,pageSize};
  }},
  {method:'GET',pattern:'admin/inventory/documents/:id',handler:async(_req,p)=>{
    await requireApi('INVENTORY_MANAGE');
    const [doc]=await db.select().from(inventoryDocuments).where(eq(inventoryDocuments.id,idParam(p.id)));
    if(!doc)throw new HttpError(404,'سند یافت نشد');
    const people=await db.select({id:users.id,name:users.name}).from(users).where(or(eq(users.id,doc.createdBy??0),eq(users.id,doc.receivedBy??0)));
    return {...doc,creatorName:people.find(u=>u.id===doc.createdBy)?.name,receiverName:people.find(u=>u.id===doc.receivedBy)?.name};
  }},
  {method:'POST',pattern:'admin/inventory/documents',handler:async(req,_p,m)=>{const u=await requireApi('INVENTORY_MANAGE');return createInventoryDocument({userId:u.id,...m},await body(req));}},
  {method:'POST',pattern:'admin/inventory/documents/:id/accept',handler:async(req,p,m)=>{const u=await requireApi('INVENTORY_MANAGE');return acceptInventoryTransfer({userId:u.id,...m},idParam(p.id),await body(req));}},
];
