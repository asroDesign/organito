import { createHash } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, inventoryDocuments, inventoryReceipts, inventoryConsignmentLots, inventorySupplierPayments, inventoryWarehouses, inventoryWarehouseStock, products, productVariants, sellerOffers, type InventoryDocumentItem } from '@/db/schema';
import { audit } from '../audit';
import { postJournal } from '../accounting';
import { HttpError, genNumber, str } from '../util';
import { allocateCharge, documentInteger, documentLines } from '../inventory-document-input';
import type { Ctx, DB } from '../types';
import { receiveStock } from './catalog';
import { ensureInventoryPartyDetail } from './inventory-accounting';
import { ensurePrimaryWarehouse } from './warehouse-stock-report';
import { stockMovements } from '@/db/schema';

type Context = Ctx & { userId: number };
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const identity = (i: { productId: number; variantId: number|null }) => `${i.productId}:${i.variantId??0}`;
const variantWhere = (id: number|null) => id === null ? isNull(inventoryWarehouseStock.variantId) : eq(inventoryWarehouseStock.variantId,id);
async function snapshot(tx: DB, productId: number, variantId: number|null, allowDeleted = false, allowProductLevel = false) {
  const [p] = await tx.select().from(products).where(eq(products.id,productId)).for('update');
  if (!p || p.source !== 'central' || p.deletedAt || p.status === 'deleted') throw new HttpError(400,'کالای انبار مرکزی معتبر نیست');
  const variants = await tx.select().from(productVariants).where(eq(productVariants.productId,productId)).orderBy(productVariants.id).for('update');
  if (variants.some(v=>!v.deletedAt) && variantId === null && !allowProductLevel) throw new HttpError(400,`تنوع دقیق «${p.nameFa}» را انتخاب کنید`);
  const v = variants.find(x=>x.id===variantId);
  if (variantId !== null && (!v || (!allowDeleted && v.deletedAt))) throw new HttpError(400,'تنوع کالا معتبر نیست');
  return { productId,variantId,title:p.nameFa+(v?` · ${v.title}`:''),sku:v?.sku??p.sku,unit:v?.inventoryUnit??p.inventoryBaseUnit,unitCost:v?.costPrice??p.avgCost };
}
async function changeStock(tx: DB, warehouse: typeof inventoryWarehouses.$inferSelect, item: InventoryDocumentItem, delta: number) {
  if(!delta)return;
  if(warehouse.sellerId){
    if(item.variantId!==null)throw new HttpError(400,'انبار تأمین‌کننده در حال حاضر موجودی را در سطح کالا مدیریت می‌کند، نه تنوع');
    const [offer]=await tx.select().from(sellerOffers).where(and(eq(sellerOffers.sellerId,warehouse.sellerId),eq(sellerOffers.productId,item.productId))).for('update');
    if(!offer)throw new HttpError(409,`برای کالای «${item.title}» پیشنهاد فعال تأمین‌کننده در ${warehouse.name} وجود ندارد`);
    if(delta<0&&offer.stock-offer.reserved < -delta)throw new HttpError(409,`موجودی آزاد «${item.title}» در ${warehouse.name} کافی نیست (${offer.stock-offer.reserved} ${item.unit})`);
    await tx.update(sellerOffers).set({stock:offer.stock+delta,updatedAt:new Date()}).where(eq(sellerOffers.id,offer.id));
    return;
  }
  if(warehouse.isDefault){
    if(item.variantId!==null){
      const [v]=await tx.select().from(productVariants).where(and(eq(productVariants.id,item.variantId),eq(productVariants.productId,item.productId))).for('update');
      if(!v)throw new HttpError(409,'تنوع کالا یافت نشد');
      if(delta<0&&v.onHand-v.reserved < -delta)throw new HttpError(409,`موجودی آزاد «${item.title}» در ${warehouse.name} کافی نیست (${v.onHand-v.reserved} ${item.unit})`);
      await tx.update(productVariants).set({onHand:v.onHand+delta}).where(eq(productVariants.id,v.id));
    }else{
      const [p]=await tx.select().from(products).where(eq(products.id,item.productId)).for('update');
      if(!p)throw new HttpError(409,'کالا یافت نشد');
      if(delta<0&&p.onHand-p.reserved < -delta)throw new HttpError(409,`موجودی آزاد «${item.title}» در ${warehouse.name} کافی نیست (${p.onHand-p.reserved} ${item.unit})`);
      await tx.update(products).set({onHand:p.onHand+delta,updatedAt:new Date()}).where(eq(products.id,p.id));
    }
  }else{
    const where=and(eq(inventoryWarehouseStock.warehouseId,warehouse.id),eq(inventoryWarehouseStock.productId,item.productId),variantWhere(item.variantId));
    await tx.insert(inventoryWarehouseStock).values({warehouseId:warehouse.id,productId:item.productId,variantId:item.variantId,onHand:0,reserved:0}).onConflictDoNothing();
    const [s]=await tx.select().from(inventoryWarehouseStock).where(where).for('update');
    if(!s||delta<0&&s.onHand-s.reserved < -delta)throw new HttpError(409,`موجودی آزاد «${item.title}» در ${warehouse.name} کافی نیست (${s?s.onHand-s.reserved:0} ${item.unit})`);
    await tx.update(inventoryWarehouseStock).set({onHand:s.onHand+delta,updatedAt:new Date()}).where(eq(inventoryWarehouseStock.id,s.id));
  }
}
async function transitAccount(tx: DB) {
  const [parent]=await tx.select().from(accounts).where(eq(accounts.code,'11'));
  await tx.insert(accounts).values({code:'1202',name:'کالای در راه بین انبارها',level:'subsidiary',type:'asset',parentId:parent?.id??null}).onConflictDoNothing({target:accounts.code});
}

export async function createInventoryDocument(ctx: Context, body: Record<string,unknown>) {
  const type=String(body.type??'');
  if(!['purchase','consignment','adjust','transfer'].includes(type))throw new HttpError(400,'نوع سند نامعتبر است');
  const lines=documentLines(body.items,type==='adjust');
  const key=str(body.idempotencyKey,100);
  if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))throw new HttpError(400,'شناسه ثبت سند نامعتبر است؛ صفحه را دوباره باز کنید');
  const payloadHash=hash({...body,items:lines});
  const dateText=str(body.documentDate,10);
  const documentDate=dateText?new Date(`${dateText}T00:00:00Z`):new Date();
  if(!Number.isFinite(documentDate.getTime())||dateText&&documentDate.toISOString().slice(0,10)!==dateText)throw new HttpError(400,'تاریخ سند نامعتبر است');
  return db.transaction(async tx=>{
    // Serializes warehouse creation/receipt, and makes retry after a timeout harmless.
    await tx.execute(sql`select pg_advisory_xact_lock(99126)`);
    const primaryWarehouse=await ensurePrimaryWarehouse(tx);
    const [existing]=await tx.select().from(inventoryDocuments).where(eq(inventoryDocuments.idempotencyKey,key));
    if(existing){if(existing.payloadHash!==payloadHash)throw new HttpError(409,'این شناسه قبلاً با اطلاعات دیگری ثبت شده است');return existing;}
    const note=str(body.note,1000);
    const items:InventoryDocumentItem[]=[];
    for(const line of lines){const snap=await snapshot(tx,line.productId,line.variantId,type==='adjust'&&line.quantity<0,type==='transfer'&&line.variantId===null);const unitCost=type==='transfer'||type==='adjust'&&(line.quantity<0||!line.unitCost)?snap.unitCost:line.unitCost;items.push({...snap,quantity:line.quantity,unitCost,freight:0,customs:0,total:line.quantity*unitCost});}
    if(items.some(i=>!Number.isSafeInteger(i.total))||Math.abs(items.reduce((s,i)=>s+i.total,0))>1_000_000_000_000_000)throw new HttpError(400,'مبلغ سند خارج از محدوده است');
    if(type==='transfer'){
      const fromId=documentInteger(body.fromWarehouseId,'انبار مبدأ',1),toId=documentInteger(body.toWarehouseId,'انبار مقصد',1);
      if(fromId===toId)throw new HttpError(400,'انبار مبدأ و مقصد باید متفاوت باشند');
      const [from]=await tx.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id,fromId)).for('update');
      const [to]=await tx.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id,toId)).for('update');
      if(!from?.enabled||!to?.enabled)throw new HttpError(400,'انبار مبدأ یا مقصد غیرفعال است');
      for(const item of items){
        const variants=await tx.select({id:productVariants.id}).from(productVariants).where(and(eq(productVariants.productId,item.productId),sql`${productVariants.deletedAt} is null`));
        if(variants.length&&item.variantId===null&&(!from.sellerId&&!to.sellerId))throw new HttpError(400,`تنوع دقیق «${item.title}» را انتخاب کنید`);
      }
      const responsibleName=str(body.responsibleName,120),responsiblePhone=str(body.responsiblePhone,30);
      if(!responsibleName)throw new HttpError(400,'نام مسئول انتقال الزامی است');
      let ownedValue=0;
      for(const item of items){
        await changeStock(tx,from,item,-item.quantity);
        const lots=await tx.select().from(inventoryConsignmentLots).where(and(eq(inventoryConsignmentLots.productId,item.productId),item.variantId===null?isNull(inventoryConsignmentLots.variantId):eq(inventoryConsignmentLots.variantId,item.variantId),from.isDefault?isNull(inventoryConsignmentLots.warehouseId):eq(inventoryConsignmentLots.warehouseId,fromId),sql`${inventoryConsignmentLots.remainingQty}>0`)).orderBy(inventoryConsignmentLots.id).for('update');
        item.consignments=[];let remaining=item.quantity;
        for(const lot of lots){if(!remaining)break;const quantity=Math.min(remaining,lot.remainingQty);await tx.update(inventoryConsignmentLots).set({remainingQty:lot.remainingQty-quantity}).where(eq(inventoryConsignmentLots.id,lot.id));item.consignments.push({receiptId:lot.receiptId,partyId:lot.partyId,quantity,unitCost:lot.unitCost});remaining-=quantity;}
        ownedValue+=remaining*item.unitCost;
      }
      const [doc]=await tx.insert(inventoryDocuments).values({number:genNumber('WT'),type,status:'issued',idempotencyKey:key,payloadHash,fromWarehouseId:fromId,toWarehouseId:toId,fromWarehouseName:from.name,toWarehouseName:to.name,responsibleName,responsiblePhone,documentDate,items,note,createdBy:ctx.userId,total:items.reduce((s,i)=>s+i.total,0)}).returning();
      await tx.insert(stockMovements).values(items.map(i=>({productId:i.productId,variantId:i.variantId,warehouseId:fromId,type:'warehouse_transfer_out',qty:-i.quantity,unitCost:i.unitCost,refType:'inventory_document',refId:doc.id,note:`${doc.number} · ${responsibleName} · خروج به ${to.name}`,userId:ctx.userId})));
      await transitAccount(tx);
      const entry=await postJournal(tx,`کالای در راه · ${doc.number} · مسئول: ${responsibleName}`,[{code:'1202',debit:ownedValue},{code:'1201',credit:ownedValue}],{type:'inventory_document',id:doc.id},ctx.userId);
      await tx.update(inventoryDocuments).set({journalEntryId:entry?.id??null}).where(eq(inventoryDocuments.id,doc.id));
      await audit(tx,ctx,'inventory.transfer.issue','inventory_document',doc.id,null,{number:doc.number,responsibleName,items});
      return {...doc,journalEntryId:entry?.id??null};
    }
    const partyId=type==='adjust'?null:documentInteger(body.partyId,'تولیدکننده / صاحب کالا',1);
    const detail=partyId?await ensureInventoryPartyDetail(tx,partyId):null;
    const invoiceNumber=str(body.invoiceNumber,100);
    if(type==='purchase'&&!invoiceNumber)throw new HttpError(400,'شماره فاکتور خرید الزامی است');
    if(partyId&&invoiceNumber){const [duplicate]=await tx.select({id:inventoryDocuments.id}).from(inventoryDocuments).where(and(eq(inventoryDocuments.partyId,partyId),eq(inventoryDocuments.invoiceNumber,invoiceNumber),eq(inventoryDocuments.type,type)));if(duplicate)throw new HttpError(409,'این شماره فاکتور برای همین طرف حساب قبلاً ثبت شده است');}
    const freight=documentInteger(body.freight??0,'هزینه حمل'),customs=documentInteger(body.customs??0,'هزینه جانبی'),paidAmount=documentInteger(body.paidAmount??0,'پرداخت اولیه');
    if(type!=='purchase'&&(freight||customs||paidAmount))throw new HttpError(400,'هزینه و پرداخت اولیه فقط برای فاکتور خرید قابل ثبت است');
    const subtotal=items.reduce((s,i)=>s+i.total,0),total=subtotal+freight+customs;
    if(!Number.isSafeInteger(total)||Math.abs(total)>1_000_000_000_000_000)throw new HttpError(400,'مبلغ کل سند خارج از محدوده است');
    if(paidAmount>total&&type==='purchase')throw new HttpError(400,'پرداخت اولیه از مبلغ فاکتور بیشتر است');
    const paymentLocation=str(body.paymentLocation,120),paymentTrackingNumber=str(body.paymentTrackingNumber,100);
    if(paidAmount&&!paymentLocation)throw new HttpError(400,'محل پرداخت الزامی است');
    const freightParts=allocateCharge(freight,items.map(i=>Math.max(0,i.total))),customsParts=allocateCharge(customs,items.map(i=>Math.max(0,i.total)));
    for(let i=0;i<items.length;i++){items[i].freight=freightParts[i];items[i].customs=customsParts[i];items[i].total+=freightParts[i]+customsParts[i];}
    const paidParts=allocateCharge(paidAmount,items.map(i=>Math.max(0,i.total)));
    const [doc]=await tx.insert(inventoryDocuments).values({number:genNumber(type==='adjust'?'ADJ':'PI'),type,status:'posted',idempotencyKey:key,payloadHash,partyId,partyName:detail?.name,invoiceNumber,documentDate,items,subtotal,freight,customs,total,paidAmount,paymentLocation,paymentTrackingNumber,note,createdBy:ctx.userId,toWarehouseId:primaryWarehouse.id,toWarehouseName:primaryWarehouse.name}).returning();
    for(const item of items)await receiveStock(ctx,item.productId,item.quantity,item.unitCost,item.freight,item.customs,`${doc.number}${note?' · '+note:''}`,item.variantId??undefined,partyId?{type:type as 'purchase'|'consignment',partyId,invoiceNumber,paymentLocation,paymentTrackingNumber,paidAmount:0}:undefined,type==='adjust',tx,doc.id);
    let journalEntryId:number|null=null,paymentJournalEntryId:number|null=null;
    if(type!=='adjust'){
      if(type==='consignment')await tx.insert(accounts).values([{code:'8101',name:'کالای امانی نزد فروشگاه (انتظامی)',level:'subsidiary',type:'memorandum'},{code:'8201',name:'مالکیت دیگران بر کالای امانی (انتظامی)',level:'subsidiary',type:'memorandum'}]).onConflictDoNothing({target:accounts.code});
      const entry=await postJournal(tx,`${type==='purchase'?'خرید':'دریافت امانی'} ${doc.number} · فاکتور ${invoiceNumber} · ${detail!.name}`,[{code:type==='purchase'?'1201':'8101',debit:total},{code:type==='purchase'?'2104':'8201',credit:total,detail1Id:detail!.id}],{type:'inventory_document',id:doc.id},ctx.userId,documentDate);
      journalEntryId=entry?.id??null;
      const receipts=await tx.select().from(inventoryReceipts).where(eq(inventoryReceipts.documentId,doc.id));
      for(const r of receipts){const ix=items.findIndex(i=>i.productId===r.productId&&i.variantId===r.variantId);await tx.update(inventoryReceipts).set({journalEntryId,paidAmount:paidParts[ix]??0}).where(eq(inventoryReceipts.id,r.id));}
      if(paidAmount){const payment=await postJournal(tx,`پرداخت اولیه ${doc.number}`,[{code:'2104',debit:paidAmount,detail1Id:detail!.id},{code:'1101',credit:paidAmount,description:paymentLocation+' · '+paymentTrackingNumber}],{type:'inventory_document_payment',id:doc.id},ctx.userId,documentDate);paymentJournalEntryId=payment?.id??null;await tx.insert(inventorySupplierPayments).values({partyId:partyId!,amount:paidAmount,paymentLocation,trackingNumber:paymentTrackingNumber,note:`پرداخت اولیه ${doc.number} · فاکتور ${invoiceNumber}`,journalEntryId:paymentJournalEntryId,userId:ctx.userId});}
    }
    await tx.update(inventoryDocuments).set({journalEntryId,paymentJournalEntryId}).where(eq(inventoryDocuments.id,doc.id));
    await audit(tx,ctx,'inventory.document.create','inventory_document',doc.id,null,{number:doc.number,type,total,items:items.length});
    return {...doc,journalEntryId,paymentJournalEntryId};
  });
}

export async function acceptInventoryTransfer(ctx: Context,id:number,body:Record<string,unknown>){
  const received=documentLines(body.items); // quantity here is the original dispatched quantity, to validate identities
  const reports=body.items as Record<string,unknown>[];
  const actual=new Map(reports.map(r=>[`${r.productId}:${r.variantId??0}`,{quantity:documentInteger(r.receivedQuantity,'تعداد مشاهده‌شده',0,100000),note:str(r.discrepancyNote,500)}]));
  const receiptNote=str(body.note,1000),toId=documentInteger(body.toWarehouseId,'انبار پذیرنده',1);
  const receiptHash=hash({toId,receiptNote,received:received.map(i=>({key:identity(i),...actual.get(identity(i))}))});
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(99126)`);
    const [doc]=await tx.select().from(inventoryDocuments).where(eq(inventoryDocuments.id,id)).for('update');
    if(!doc||doc.type!=='transfer')throw new HttpError(404,'حواله انتقال یافت نشد');
    if(doc.toWarehouseId!==toId)throw new HttpError(400,'این حواله برای انبار مقصد انتخاب‌شده صادر نشده است');
    if(doc.status!=='issued'){if(doc.receiptHash===receiptHash)return doc;throw new HttpError(409,'این حواله قبلاً پذیرش شده است');}
    if(actual.size!==doc.items.length||doc.items.some(i=>!actual.has(identity(i))))throw new HttpError(400,'پذیرش باید دقیقاً شامل همه اقلام حواله باشد');
    const [to]=await tx.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id,toId)).for('update');
    if(!to?.enabled)throw new HttpError(400,'انبار مقصد غیرفعال است');
    const [from]=doc.fromWarehouseId?await tx.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id,doc.fromWarehouseId)):[];
    const allowProductLevel=!!(from?.sellerId||to.sellerId);
    let difference=false,ownedValue=0;
    const items:InventoryDocumentItem[]=[];
    for(const item of doc.items){
      const report=actual.get(identity(item))!;
      if(report.quantity!==item.quantity){difference=true;if(!report.note)throw new HttpError(400,`شرح اختلاف «${item.title}» را وارد کنید`);}
      const accepted=Math.min(report.quantity,item.quantity);
      await snapshot(tx,item.productId,item.variantId,true,allowProductLevel);
      await changeStock(tx,to,item,accepted);
      let remaining=accepted;
      for(const chunk of item.consignments??[]){const quantity=Math.min(remaining,chunk.quantity);if(quantity)await tx.insert(inventoryConsignmentLots).values({warehouseId:to.isDefault?null:to.id,receiptId:chunk.receiptId,partyId:chunk.partyId,productId:item.productId,variantId:item.variantId,initialQty:quantity,remainingQty:quantity,unitCost:chunk.unitCost});remaining-=quantity;}
      ownedValue+=remaining*item.unitCost;
      if(accepted)await tx.insert(stockMovements).values({productId:item.productId,variantId:item.variantId,warehouseId:toId,type:'warehouse_transfer_in',qty:accepted,unitCost:item.unitCost,refType:'inventory_document',refId:doc.id,note:`پذیرش ${doc.number} · مسئول: ${doc.responsibleName}`,userId:ctx.userId});
      items.push({...item,receivedQuantity:report.quantity,acceptedQuantity:accepted,discrepancyNote:report.note});
    }
    await transitAccount(tx);
    const entry=await postJournal(tx,`پذیرش حواله ${doc.number} · مسئول: ${doc.responsibleName}`,[{code:'1201',debit:ownedValue},{code:'1202',credit:ownedValue}],{type:'inventory_document_receipt',id:doc.id},ctx.userId);
    const [updated]=await tx.update(inventoryDocuments).set({items,status:difference?'received_with_difference':'received',receivedBy:ctx.userId,receivedAt:new Date(),receiptHash,receiptNote,receivedJournalEntryId:entry?.id??null}).where(eq(inventoryDocuments.id,id)).returning();
    await audit(tx,ctx,'inventory.transfer.accept','inventory_document',id,{status:doc.status},{status:updated.status,responsibleName:doc.responsibleName,items});
    return updated;
  });
}
