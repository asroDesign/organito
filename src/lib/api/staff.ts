import { createInventoryDocument } from "../services/inventory-documents";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, inventoryParties, inventorySupplierPayments, journalLines, orderItems, sellers, settings, smsTemplates, tickets, users, sellerShipments, sellerPosItems, ticketMessages, ticketDepartments, notifications, inventoryWarehouses, inventoryWarehouseStock, productVariants, products, sellerOffers, stockMovements } from "@/db/schema";
import { requireApi, rateLimit, hashPassword } from "../auth";
import { audit } from "../audit";
import { postJournal, reverseJournal } from "../accounting";
import { HttpError, int, str, genNumber } from "../util";
import { PERMISSIONS, ROLES } from "../rbac";
import { DEFAULT_SETTINGS } from "../settings";
import { sendSms, SMS_EVENTS } from "../sms";
import { cancelOrder, payOrder, updateShipment } from "../services/orders";
import { receiveStock, repackStock, saveProduct, setBuyBox, setOfferStatus, setProductStatus, upsertOffer } from "../services/catalog";
import { requestWithdrawal, reviewWithdrawal } from "../services/wallet";
import { sellerQuote, staffSupplyAction, type SupplyAction } from "../services/supply";
import { body, idParam, type Route } from "./router";
import { assertSellerAllowed } from "../services/kyc";
import { ensureInventoryPartyDetail } from "../services/inventory-accounting";
import { ensurePrimaryWarehouse } from "../services/warehouse-stock-report";

async function requireSeller() {
  const u = await requireApi();
  if (!u.sellerId) throw new HttpError(403, "فقط تأمین‌کنندگان");
  return u as typeof u & { sellerId: number };
}

export const staffRoutes: Route[] = [
  { method: "GET", pattern: "admin/inventory/warehouses", handler: async () => {
    await requireApi("INVENTORY_MANAGE");
    await db.transaction(tx=>ensurePrimaryWarehouse(tx));
    const approvedSellers=await db.select().from(sellers).where(and(eq(sellers.status,"approved"),eq(sellers.restricted,false)));
    const knownLocations=await db.select({sellerId:inventoryWarehouses.sellerId}).from(inventoryWarehouses).where(sql`${inventoryWarehouses.sellerId} is not null`);
    const knownSellerIds=new Set(knownLocations.map(row=>row.sellerId));
    const missingLocations=approvedSellers.filter(seller=>!knownSellerIds.has(seller.id));
    if(missingLocations.length)await db.insert(inventoryWarehouses).values(missingLocations.map(seller=>({name:`انبار تأمین‌کننده · ${seller.shopName}`,code:`SUP-${seller.id}`,address:seller.city,sellerId:seller.id,enabled:true,isDefault:false}))).onConflictDoNothing();
    const [warehouses, stock, productRows, variantRows, parties, offers] = await Promise.all([
      db.select().from(inventoryWarehouses).orderBy(inventoryWarehouses.isDefault, inventoryWarehouses.name),
      db.select().from(inventoryWarehouseStock),
      db.select({ product: products }).from(products).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa),
      db.select({ variant: productVariants, productName: products.nameFa, baseUnit: products.inventoryBaseUnit, avgCost: products.avgCost }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa, productVariants.title),
      db.select({ id: inventoryParties.id, name: inventoryParties.name }).from(inventoryParties).where(eq(inventoryParties.enabled, true)).orderBy(inventoryParties.name),
      db.select({ offer: sellerOffers, seller: sellers, product: products }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId)).innerJoin(products, eq(products.id, sellerOffers.productId)).where(and(eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false), eq(products.source,"central"), sql`${products.status} <> 'deleted'`)),
    ]);
    const supplierWarehouses = warehouses.filter(w => w.sellerId);
    const variantProductIds = new Set(variantRows.filter(({variant}) => !variant.deletedAt).map(({variant})=>variant.productId));
    const supplierOffers = offers.filter(({product})=>!variantProductIds.has(product.id));
    const supplierStock = supplierOffers.map(({offer}) => { const warehouse=supplierWarehouses.find(w=>w.sellerId===offer.sellerId); return warehouse ? {id:-offer.id,warehouseId:warehouse.id,productId:offer.productId,variantId:null,onHand:offer.stock,reserved:offer.reserved} : null; }).filter(Boolean);
    const items = [
      ...variantRows.filter(({ variant }) => !variant.deletedAt).map(({ variant, productName, baseUnit, avgCost }) => ({ productId: variant.productId, variantId: variant.id, label: `${productName} · ${variant.title}`, sku: variant.sku, unit: variant.inventoryUnit || baseUnit, unitCost: variant.costPrice ?? avgCost, centralAvailable: variant.onHand - variant.reserved })),
      ...productRows.filter(({ product }) => !variantRows.some(({ variant }) => variant.productId === product.id)).map(({ product }) => ({ productId: product.id, variantId: null, label: product.nameFa, sku: product.sku, unit: product.inventoryBaseUnit, unitCost: product.avgCost, centralAvailable: product.onHand - product.reserved })),
    ];
    const centralItemKeys=new Set(items.map(item=>`${item.productId}:${item.variantId??0}`));
    const supplierItems = supplierOffers.filter(({product})=>!centralItemKeys.has(`${product.id}:0`)).map(({offer,product})=>({productId:product.id,variantId:null,label:product.nameFa,sku:product.sku,unit:product.inventoryBaseUnit,unitCost:offer.costPrice??product.avgCost,centralAvailable:offer.stock-offer.reserved}));
    const mainWarehouse=warehouses.find(w=>w.isDefault);
    const centralStock=mainWarehouse?[...variantRows.filter(({variant})=>!variant.deletedAt||variant.onHand!==0||variant.reserved!==0).map(({variant})=>({id:-variant.id,warehouseId:mainWarehouse.id,productId:variant.productId,variantId:variant.id,onHand:variant.onHand,reserved:variant.reserved})),...productRows.filter(({product})=>!variantRows.some(({variant})=>variant.productId===product.id&&!variant.deletedAt)).map(({product})=>({id:-1_000_000-product.id,warehouseId:mainWarehouse.id,productId:product.id,variantId:null,onHand:product.onHand,reserved:product.reserved}))]:[];
    return { warehouses, stock:[...centralStock,...stock.filter(row=>!supplierWarehouses.some(w=>w.id===row.warehouseId)),...supplierStock], items:[...items,...supplierItems], parties };
  } },
  { method: "POST", pattern: "admin/inventory/warehouses", handler: async (req, _p, meta) => {
    const user = await requireApi("INVENTORY_MANAGE"), b = await body(req), name = str(b.name, 100), code = str(b.code, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, ""), address = str(b.address, 300);
    if (!name || !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) throw new HttpError(400, "نام انبار و کد یکتای ۲ تا ۲۰ حرفی لازم است");
    const [row] = await db.insert(inventoryWarehouses).values({ name, code, address: address || null }).returning();
    await audit(db, { userId: user.id, ...meta }, "inventory.warehouse.create", "inventory_warehouse", row.id, null, row);
    return row;
  } },
  { method: "PUT", pattern: "admin/inventory/warehouses/:id", handler: async (req, p, meta) => {
    const user = await requireApi("INVENTORY_MANAGE"), id = idParam(p.id), b = await body(req), name = str(b.name, 100), address = str(b.address, 300);
    if (!name) throw new HttpError(400, "نام انبار الزامی است");
    const [old] = await db.select().from(inventoryWarehouses).where(eq(inventoryWarehouses.id, id));
    if (!old) throw new HttpError(404, "انبار پیدا نشد");
    const [row] = await db.update(inventoryWarehouses).set({ name, address: address || null, enabled: old.isDefault ? true : b.enabled === true, updatedAt: new Date() }).where(eq(inventoryWarehouses.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "inventory.warehouse.update", "inventory_warehouse", id, old, row);
    return row;
  } },
  { method: "POST", pattern: "admin/inventory/warehouses/transfers", handler: async (req, _p, meta) => {
    const user = await requireApi("INVENTORY_MANAGE"), b = await body(req);
    return createInventoryDocument({ userId: user.id, ...meta }, { ...b, type: "transfer" });
  } },
  // ---------- products (seller or staff) ----------
  { method: "POST", pattern: "products", handler: async (req, _p, m) => {
    const u = await requireApi();
    if (!u.sellerId && !u.staff) throw new HttpError(403, "دسترسی غیرمجاز");
    if (u.sellerId && !u.staff) await assertSellerAllowed(u.sellerId, "ثبت محصول جدید");
    return saveProduct({ userId: u.id, ...m }, u, await body(req));
  } },
  { method: "PUT", pattern: "products/:id", handler: async (req, p, m) => {
    const u = await requireApi();
    if (!u.sellerId && !u.staff) throw new HttpError(403, "دسترسی غیرمجاز");
    if (u.sellerId && !u.staff) await assertSellerAllowed(u.sellerId, "ویرایش محصول");
    return saveProduct({ userId: u.id, ...m }, u, await body(req), idParam(p.id));
  } },
  { method: "POST", pattern: "products/:id/status", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const status = String(b.status);
    if (!["draft", "pending", "approved", "active", "inactive", "out_of_stock", "rejected", "suspended", "deleted"].includes(status)) throw new HttpError(400, "وضعیت نامعتبر");
    await setProductStatus({ userId: u.id, ...m }, u, idParam(p.id), status, str(b.reason, 500));
    return { ok: true };
  } },

  // ---------- seller ----------
  { method: "POST", pattern: "seller/offers", handler: async (req, _p, m) => {
    const u = await requireSeller();
    await assertSellerAllowed(u.sellerId, "ثبت یا ویرایش پیشنهاد فروش");
    return upsertOffer({ userId: u.id, ...m }, u.sellerId, await body(req));
  } },
  { method: "POST", pattern: "seller/offers/:id/status", handler: async (req, p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    if (String(b.status) === "approved") await assertSellerAllowed(u.sellerId, "فعال‌سازی پیشنهاد");
    await setOfferStatus({ userId: u.id, ...m }, idParam(p.id), String(b.status), { sellerId: u.sellerId, staff: false });
    return { ok: true };
  } },
  { method: "POST", pattern: "seller/shipments/:id", handler: async (req, p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    return updateShipment({ userId: u.id, ...m }, idParam(p.id), { status: String(b.status), carrier: str(b.carrier, 60), trackingNumber: str(b.trackingNumber, 60), carrierId: b.carrierId ? int(b.carrierId, 1) : null, shippedAt: /^\d{4}-\d{2}-\d{2}$/.test(str(b.shippedAt, 10)) ? new Date(`${str(b.shippedAt, 10)}T12:00:00+03:30`) : undefined, packageCount: b.packageCount ? int(b.packageCount, 1, 50) : undefined, notes: str(b.notes, 500) || undefined }, { sellerId: u.sellerId, staff: false });
  } },
  { method: "POST", pattern: "seller/withdrawals", handler: async (req, _p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    const key = str(b.idempotencyKey, 100);
    if (key.length < 8) throw new HttpError(400, "کلید یکتا الزامی است");
    await assertSellerAllowed(u.sellerId, "درخواست برداشت وجه");
    const wd = await requestWithdrawal({ userId: u.id, ...m }, u.sellerId, int(b.amount, 1), str(b.iban, 30).replace(/\s/g, "").toUpperCase(), `wd:${u.sellerId}:${key}`);
    return { id: wd.id, status: wd.status };
  } },
  { method: "POST", pattern: "seller/withdrawals/:id/cancel", handler: async (_r, p, m) => {
    const u = await requireSeller();
    const wd = await reviewWithdrawal({ userId: u.id, ...m }, idParam(p.id), "cancel", undefined, "لغو توسط فروشنده", u.sellerId);
    return { id: wd.id, status: wd.status };
  } },
  { method: "POST", pattern: "seller/rfq/:id", handler: async (req, p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    await assertSellerAllowed(u.sellerId, "پاسخ به RFQ");
    await sellerQuote({ userId: u.id, ...m }, u.sellerId, idParam(p.id), { price: int(b.price, 1000), stock: int(b.stock ?? 0, 0, 10000), leadDays: int(b.leadDays ?? 0, 0, 120), validUntil: str(b.validUntil, 40), brand: str(b.brand, 60), note: str(b.note, 500) });
    return { ok: true };
  } },
  { method: "GET", pattern: "seller/report.csv", handler: async () => {
    const u = await requireSeller();
    const result = await db.execute(sql`select product, sum(qty)::int qty, sum(gross)::bigint gross, sum(commission)::bigint commission from (
      select oi.title product, oi.qty, oi.line_total gross, round(oi.line_total * s.commission_rate / 100.0)::bigint commission
        from order_items oi join seller_shipments sh on sh.id = oi.shipment_id join orders o on o.id = oi.order_id join sellers s on s.id = sh.seller_id
        where oi.seller_id = ${u.sellerId} and o.payment_status = 'paid' and sh.status <> 'cancelled'
      union all select pi.title product, pi.quantity qty, pi.line_total gross, 0::bigint commission
        from seller_pos_items pi where pi.seller_id = ${u.sellerId}
    ) sales group by product order by gross desc`);
    const rows = result.rows as { product: string; qty: number; gross: number; commission: number }[];
    const lines = ["product,qty,gross,commission,net", ...rows.map((r) => {
      const c = Number(r.commission);
      return `"${r.product.replace(/"/g, "'")}",${r.qty},${r.gross},${c},${Number(r.gross) - c}`;
    })];
    return new Response("\uFEFF" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=seller-report.csv" } });
  } },

  // ---------- admin ----------
  { method: "POST", pattern: "admin/offers/:id/status", handler: async (req, p, m) => {
    const u = await requireApi("SUPPLIER_OFFERS_MANAGE");
    const b = await body(req);
    await setOfferStatus({ userId: u.id, ...m }, idParam(p.id), String(b.status), { staff: true });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/offers/:id/buybox", handler: async (_r, p, m) => {
    const u = await requireApi("SUPPLIER_OFFERS_MANAGE");
    await setBuyBox({ userId: u.id, ...m }, idParam(p.id));
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sellers/:id", handler: async (req, p, m) => {
    const u = await requireApi("SELLER_SETTLEMENT_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [old] = await db.select().from(sellers).where(eq(sellers.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    const patch = {
      status: ["pending", "approved", "rejected", "suspended"].includes(String(b.status)) ? String(b.status) : old.status,
      contractStatus: ["pending", "signed", "expired"].includes(String(b.contractStatus)) ? String(b.contractStatus) : old.contractStatus,
      commissionRate: b.commissionRate !== undefined && b.commissionRate !== "" ? int(b.commissionRate, 0, 50) : old.commissionRate,
      settlementDays: b.settlementDays !== undefined && b.settlementDays !== "" ? int(b.settlementDays, 0, 90) : old.settlementDays,
    };
    await db.update(sellers).set(patch).where(eq(sellers.id, id));
    await audit(db, { userId: u.id, ...m }, "seller.update", "seller", id, { status: old.status, commissionRate: old.commissionRate }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/shipments/:id", handler: async (req, p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const b = await body(req);
    return updateShipment({ userId: u.id, ...m }, idParam(p.id), { status: String(b.status), carrier: str(b.carrier, 60), trackingNumber: str(b.trackingNumber, 60), carrierId: b.carrierId ? int(b.carrierId, 1) : null, shippedAt: /^\d{4}-\d{2}-\d{2}$/.test(str(b.shippedAt, 10)) ? new Date(`${str(b.shippedAt, 10)}T12:00:00+03:30`) : undefined, packageCount: b.packageCount ? int(b.packageCount, 1, 50) : undefined, notes: str(b.notes, 500) || undefined }, { sellerId: null, staff: true });
  } },
  { method: "POST", pattern: "admin/orders/:id/cancel", handler: async (req, p, m) => {
    const u = await requireApi("ORDERS_MANAGE");
    const b = await body(req);
    await cancelOrder({ userId: u.id, ...m }, idParam(p.id), { staff: true }, str(b.reason, 300) || "لغو توسط مدیر");
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/orders/:id/pay", handler: async (req, p, m) => {
    const u = await requireApi("PAYMENTS_MANAGE");
    const b = await body(req);
    await payOrder({ userId: u.id, ...m }, idParam(p.id), `adm:${str(b.idempotencyKey, 100)}`, true);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/withdrawals/:id", handler: async (req, p, m) => {
    const u = await requireApi("WITHDRAWALS_MANAGE");
    const b = await body(req);
    const action = String(b.action);
    if (!["approve", "reject", "process", "pay"].includes(action)) throw new HttpError(400, "عملیات نامعتبر");
    const wd = await reviewWithdrawal({ userId: u.id, ...m }, idParam(p.id), action as "approve", str(b.trackingCode, 60) || undefined, str(b.note, 300) || undefined);
    return { id: wd.id, status: wd.status, trackingCode: wd.trackingCode };
  } },
  { method: "POST", pattern: "admin/supply/:id", handler: async (req, p, m) => {
    const u = await requireApi("SUPPLY_REQUESTS_MANAGE");
    const b = await body(req);
    const a = { ...b, action: String(b.action) } as unknown as SupplyAction;
    if (!["review", "search", "rfq", "select_quote", "calculate", "send_quotation", "assign", "advance", "reject"].includes(a.action)) throw new HttpError(400, "عملیات نامعتبر");
    await staffSupplyAction({ userId: u.id, ...m }, idParam(p.id), a);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/inventory/repack", handler: async (req, _p, m) => {
    const u = await requireApi("INVENTORY_MANAGE");
    const b = await body(req);
    await repackStock({ userId: u.id, ...m }, { productId: int(b.productId, 1), sourceVariantId: int(b.sourceVariantId, 1), targetVariantId: int(b.targetVariantId, 1), inputQty: int(b.inputQty, 1, 100000), outputQty: int(b.outputQty, 1, 100000), note: str(b.note, 300) });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/inventory/parties", handler: async (req, _p, m) => {
    const u = await requireApi("INVENTORY_MANAGE"), b = await body(req), name = str(b.name, 120);
    if (!name) throw new HttpError(400, "نام تولیدکننده یا صاحب کالا الزامی است");
    const party = await db.transaction(async (tx) => {
      const [created] = await tx.insert(inventoryParties).values({ name, phone: str(b.phone, 30) || null, nationalId: str(b.nationalId, 20) || null, address: str(b.address, 300) || null }).returning();
      const detail = await ensureInventoryPartyDetail(tx, created.id);
      const [saved] = await tx.select().from(inventoryParties).where(eq(inventoryParties.id, created.id));
      await audit(tx, { userId: u.id, ...m }, "inventory_party.create", "inventory_party", created.id, null, { ...saved, detailAccount: detail.code });
      return saved;
    });
    return party;
  } },
  { method: "POST", pattern: "admin/inventory/parties/:id/payments", handler: async (req, p, m) => {
    const u = await requireApi("INVENTORY_MANAGE"), id = int(p.id, 1), b = await body(req), amount = int(b.amount, 1, 1_000_000_000_000);
    const location = str(b.paymentLocation, 120);
    if (!location) throw new HttpError(400, "محل پرداخت را وارد کنید");
    return db.transaction(async (tx) => {
      const detail = await ensureInventoryPartyDetail(tx, id);
      const [party] = await tx.select().from(inventoryParties).where(eq(inventoryParties.id, id));
      const [row] = await tx.select({ balance: sql<number>`coalesce(sum(${journalLines.credit} - ${journalLines.debit}),0)` }).from(journalLines)
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(and(eq(accounts.code, "2104"), eq(journalLines.detail1Id, detail.id)));
      const outstanding = Number(row?.balance ?? 0);
      if (amount > outstanding) throw new HttpError(400, `مانده بدهی ${party.name} فقط ${outstanding.toLocaleString("fa-IR")} است`);
      const trackingNumber = str(b.trackingNumber, 100), note = str(b.note, 300);
      const [payment] = await tx.insert(inventorySupplierPayments).values({ partyId: id, amount, paymentLocation: location, trackingNumber: trackingNumber || null, note: note || null, userId: u.id }).returning();
      const entry = await postJournal(tx, `تسویه حساب با ${party.name} · ${location}${trackingNumber ? ` · پیگیری ${trackingNumber}` : ""}`, [
        { code: "2104", debit: amount, detail1Id: detail.id }, { code: "1101", credit: amount, description: `${location}${trackingNumber ? ` · پیگیری ${trackingNumber}` : ""}` },
      ], { type: "inventory_supplier_payment", id: payment.id }, u.id);
      if (entry) await tx.update(inventorySupplierPayments).set({ journalEntryId: entry.id }).where(eq(inventorySupplierPayments.id, payment.id));
      await audit(tx, { userId: u.id, ...m }, "inventory_supplier.settlement", "inventory_party", id, { outstanding }, { paymentId: payment.id, amount, outstandingAfter: outstanding - amount });
      return { ok: true, id: payment.id, balance: outstanding - amount };
    });
  } },
  { method: "POST", pattern: "admin/inventory/:id", handler: async (req, p, m) => {
    const u = await requireApi("INVENTORY_MANAGE");
    const b = await body(req);
    const qty = Math.trunc(Number(b.qty));
    if (!Number.isFinite(qty) || qty === 0 || Math.abs(qty) > 100000) throw new HttpError(400, "تعداد نامعتبر");
    const receiptType = String(b.receiptType ?? "");
    const operationType = String(b.operationType ?? (receiptType || "adjust"));
    const normalizedReceiptType = receiptType || operationType;
    if (!["purchase", "consignment", "adjust"].includes(operationType)) throw new HttpError(400, "نوع عملیات انبار نامعتبر است");
    if (operationType === "adjust" && receiptType) throw new HttpError(400, "برای تعدیل، نوع رسید خرید یا امانی ارسال نشود");
    if (operationType !== "adjust" && qty < 0) throw new HttpError(400, "رسید خرید یا امانی باید با مقدار مثبت ثبت شود");
    if (operationType !== "adjust" && !["purchase", "consignment"].includes(receiptType || operationType)) throw new HttpError(400, "نوع رسید را انتخاب کنید");
    if (operationType !== "adjust" && receiptType && receiptType !== operationType) throw new HttpError(400, "نوع رسید با نوع عملیات مطابقت ندارد");
    const receipt = qty > 0 && operationType !== "adjust" ? {
      type: normalizedReceiptType as "purchase" | "consignment", partyId: int(b.partyId, 1), invoiceNumber: str(b.invoiceNumber, 100),
      paymentLocation: str(b.paymentLocation, 120), paymentTrackingNumber: str(b.paymentTrackingNumber, 100), paidAmount: int(b.paidAmount ?? 0, 0, 1_000_000_000_000),
    } : undefined;
    if (qty > 0 && receiptType === "purchase" && !receipt?.invoiceNumber) throw new HttpError(400, "شماره فاکتور خرید را وارد کنید");
    await receiveStock({ userId: u.id, ...m }, idParam(p.id), qty, int(b.unitCost ?? 0), int(b.freight ?? 0), int(b.customs ?? 0), str(b.note, 300), b.variantId ? int(b.variantId, 1) : undefined, receipt, operationType === "adjust");
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/journal", handler: async (req, _p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    const b = await body(req);
    const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]).map((l) => ({ code: str(l.code, 10), debit: int(l.debit ?? 0), credit: int(l.credit ?? 0), detail1: str(l.detail1, 60) || undefined })) : [];
    if (lines.length < 2) throw new HttpError(400, "سند حداقل دو آرتیکل دارد");
    const d = lines.reduce((a, l) => a + l.debit, 0), c = lines.reduce((a, l) => a + l.credit, 0);
    if (d !== c) throw new HttpError(400, "جمع بدهکار و بستانکار برابر نیست");
    const e = await db.transaction(async (tx) => {
      const e = await postJournal(tx, str(b.description, 300) || "سند دستی", lines, { type: "manual", id: 0 }, u.id);
      await audit(tx, { userId: u.id, ...m }, "journal.create", "journal", e?.id ?? null, null, { lines: lines.length, amount: d });
      return e;
    });
    return { id: e?.id };
  } },
  { method: "POST", pattern: "admin/journal/:id/reverse", handler: async (_r, p, m) => {
    const u = await requireApi("ACCOUNTING_MANAGE");
    await db.transaction(async (tx) => {
      await reverseJournal(tx, idParam(p.id), "برگشت دستی", u.id);
      await audit(tx, { userId: u.id, ...m }, "journal.reverse", "journal", p.id);
    });
    return { ok: true };
  } },
  { method: "GET", pattern: "admin/tickets/customers", handler: async (req) => {
    await requireApi("TICKETS_MANAGE"); const q=(req.nextUrl.searchParams.get("q")??"").trim();
    if(q.length<2)return [];
    return db.select({id:users.id,name:users.name,phone:users.phone}).from(users).where(and(eq(users.role,"customer"),eq(users.isActive,true),sql`(${users.name} ilike ${`%${q}%`} or ${users.phone} ilike ${`%${q}%`})`)).orderBy(users.name).limit(20);
  } },
  { method: "POST", pattern: "admin/tickets", handler: async (req,_p,m) => {
    const staff=await requireApi("TICKETS_MANAGE"),b=await body(req),customerId=int(b.customerId,1),subject=str(b.subject,160),text=str(b.message,5000),department=str(b.department,60)||"support",priority=str(b.priority,20)||"normal";
    if(subject.length<3||text.length<5)throw new HttpError(400,"موضوع و متن تیکت را کامل وارد کنید");
    if(!["low","normal","high","urgent"].includes(priority))throw new HttpError(400,"اولویت تیکت معتبر نیست");
    const [customer]=await db.select({id:users.id}).from(users).where(and(eq(users.id,customerId),eq(users.role,"customer"),eq(users.isActive,true)));
    if(!customer)throw new HttpError(404,"مشتری فعال پیدا نشد");
    const [dep]=await db.select().from(ticketDepartments).where(and(eq(ticketDepartments.key,department),eq(ticketDepartments.isActive,true)));
    if(!dep)throw new HttpError(400,"دپارتمان انتخاب‌شده فعال نیست");
    const result=await db.transaction(async tx=>{
      const [ticket]=await tx.insert(tickets).values({number:genNumber("TK"),customerId,subject,department:dep.key,priority,status:"pending_customer",assigneeId:staff.id}).returning();
      await tx.insert(ticketMessages).values({ticketId:ticket.id,userId:staff.id,body:text});
      await tx.insert(notifications).values({userId:customerId,title:"تیکت پشتیبانی جدید",body:subject,link:`/account/tickets/${ticket.id}`});
      await audit(tx,{userId:staff.id,...m},"admin.ticket.create","ticket",ticket.id,null,{customerId,subject,department:dep.key,priority});
      return ticket;
    });
    return {ok:true,id:result.id,number:result.number};
  } },
  { method: "POST", pattern: "admin/tickets/:id", handler: async (req, p, m) => {
    const u = await requireApi("TICKETS_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!t) throw new HttpError(404, "یافت نشد");
    const patch = {
      status: ["open", "in_review", "pending_customer", "pending_staff", "resolved", "closed"].includes(String(b.status)) ? String(b.status) : t.status,
      priority: ["low", "normal", "high", "urgent"].includes(String(b.priority)) ? String(b.priority) : t.priority,
      assigneeId: b.assigneeId ? int(b.assigneeId, 1) : t.assigneeId, updatedAt: new Date(),
    };
    await db.update(tickets).set(patch).where(eq(tickets.id, id));
    await audit(db, { userId: u.id, ...m }, "ticket.update", "ticket", id, { status: t.status, assigneeId: t.assigneeId }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sms/test", handler: async (req) => {
    const u = await requireApi("SMS_MANAGE");
    rateLimit(`smstest:${u.id}`, 5, 60_000);
    const b = await body(req);
    const event = String(b.event);
    if (!SMS_EVENTS[event]) throw new HttpError(400, "رویداد نامعتبر");
    const phone = str(b.phone, 20);
    if (!/^09\d{9}$/.test(phone)) throw new HttpError(400, "شماره نامعتبر");
    const vars = Object.fromEntries(SMS_EVENTS[event].vars.map((v) => [v, "نمونه"]));
    return sendSms(event, phone, vars, true);
  } },
  { method: "POST", pattern: "admin/sms/:id", handler: async (req, p, m) => {
    const u = await requireApi("SMS_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [t] = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id));
    if (!t) throw new HttpError(404, "یافت نشد");
    const patch = { isActive: b.isActive !== undefined ? b.isActive === true : t.isActive, patternId: b.patternId !== undefined ? str(b.patternId, 40) : t.patternId, body: b.body !== undefined ? str(b.body, 500) || t.body : t.body };
    await db.update(smsTemplates).set(patch).where(eq(smsTemplates.id, id));
    await audit(db, { userId: u.id, ...m }, "sms.template_update", "sms_template", id, { isActive: t.isActive, patternId: t.patternId }, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/settings", handler: async (req, _p, m) => {
    const u = await requireApi("SETTINGS_MANAGE");
    const b = await body(req);
    const changes: Record<string, unknown> = {};
    for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(k in b)) continue;
      if (["smsApiKey", "smsPassword", "torobpayClientSecret", "torobpayPassword", "nextpayApiKey", "digipayClientSecret", "digipayPassword", "snappayClientSecret", "snappayPassword", "behpardakhtPassword", "pasargadPassword", "vandarApiKey"].includes(k) && !str(b[k], 1000)) continue;
      let v: unknown;
      if (k === "smsProvider" && !["kavenegar", "smsir", "ghasedak", "melipayamak", "mediana", "ippanel"].includes(str(b[k], 20))) throw new HttpError(400, "سرویس پیامک نامعتبر است");
      if (k === "appearanceMode" && !["light", "dark", "system"].includes(str(b[k], 12))) throw new HttpError(400, "حالت ظاهری نامعتبر است");
      if (k === "appearancePalette" && !["sunshine", "forest", "ocean"].includes(str(b[k], 20))) throw new HttpError(400, "رنگ سازمانی نامعتبر است");
      if (k === "productTypes") {
        if (!Array.isArray(b[k])) throw new HttpError(400, "فهرست نوع محصولات نامعتبر است");
        v = (b[k] as Record<string, unknown>[]).map((x) => ({ name: str(x.name, 80), parameters: Array.isArray(x.parameters) ? [...new Set(x.parameters.map((p) => str(p, 80)).filter(Boolean))].slice(0, 40) : [] })).filter((x) => x.name).slice(0, 80);
        if (new Set((v as {name:string}[]).map((x) => x.name)).size !== (v as {name:string}[]).length) throw new HttpError(400, "نام نوع محصول تکراری است");
      } else if (k === "robotsSitemapEnabled") v = b[k] === true || b[k] === 1 || b[k] === "1" ? 1 : 0;
      else if (k === "robotsUserAgents") {
        const agents = [...new Set(str(b[k], 2000).split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
        if (agents.length > 30 || agents.some((x) => !/^(\*|[A-Za-z0-9._-]{1,80})$/.test(x))) throw new HttpError(400, "نام ربات نامعتبر است؛ هر ربات را در یک خط وارد کنید");
        v = agents.join("\n") || "*";
      } else if (k === "robotsAllowPaths" || k === "robotsDisallowPaths") {
        const paths = [...new Set(str(b[k], 10000).split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];
        if (paths.length > 100 || paths.some((x) => x.length > 300 || !x.startsWith("/") || x.startsWith("//") || /[?#\s\u0000-\u001f]/.test(x))) throw new HttpError(400, "مسیر robots نامعتبر است؛ هر مسیر باید با / شروع شود و آدرس کامل نباشد");
        v = paths.join("\n");
      } else v = typeof def === "number" ? int(b[k], 0, 1_000_000_000) : str(b[k], k === "footerScripts" ? 20000 : 1000);
      if (["invoiceWidth", "barcodeLabelWidth", "barcodeLabelHeight"].includes(k) && Number(v) < 20) throw new HttpError(400, "ابعاد چاپ باید دست‌کم ۲۰ میلی‌متر باشد");
      if (["invoiceFontSize", "barcodeFontSize"].includes(k) && (Number(v) < 6 || Number(v) > 40)) throw new HttpError(400, "اندازه فونت چاپ باید بین ۶ تا ۴۰ باشد");
      if (k === "invoicePadding" && (Number(v) < 0 || Number(v) > 30)) throw new HttpError(400, "حاشیه داخلی فاکتور باید بین ۰ تا ۳۰ میلی‌متر باشد");
      if (k === "invoiceBorderStyle" && !["solid", "dashed", "none"].includes(String(v))) throw new HttpError(400, "نوع کادر فاکتور معتبر نیست");
      if (["invoiceBorderColor", "invoiceAccentColor"].includes(k) && !/^#[0-9a-f]{6}$/i.test(String(v))) throw new HttpError(400, "رنگ فاکتور باید کد HEX شش‌رقمی باشد");
      if (k === "organicBadgeLabel" && !str(v, 80)) throw new HttpError(400, "عنوان نشان اصالت کالا نمی‌تواند خالی باشد");
      if (k === "paymentGateway" && v !== "zarinpal" && v !== "zibal") throw new HttpError(400, "درگاه پرداخت نامعتبر است");
      if ((/^payment[A-Za-z]+Enabled$/.test(k) || ["paymentGatewaysConfigured", "paymentManualEnabled", "zarinpalSandbox", "digipaySandbox"].includes(k)) && ![0, 1].includes(Number(v))) throw new HttpError(400, "وضعیت فعال‌سازی درگاه نامعتبر است");
      if (/^payment[A-Za-z]+IconId$/.test(k) && Number(v) < 0) throw new HttpError(400, "شناسه آیکن درگاه نامعتبر است");
      if (k === "snappayApiBaseUrl" && v) { try { const url = new URL(String(v)); if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error(); } catch { throw new HttpError(400, "نشانی API اسنپ‌پی باید دامنه HTTPS باشد"); } }
      if (k === "digipayAmountMultiplier" && ![1, 10].includes(Number(v))) throw new HttpError(400, "واحد مبلغ دیجی‌پی نامعتبر است");
      if (k === "digipayPreferredGateway" && ![0, 2].includes(Number(v))) throw new HttpError(400, "روش پرداخت دیجی‌پی نامعتبر است");
      changes[k] = ["smsApiKey", "smsPassword", "torobpayClientSecret", "torobpayPassword", "nextpayApiKey", "digipayClientSecret", "digipayPassword", "snappayClientSecret", "snappayPassword", "behpardakhtPassword", "pasargadPassword", "vandarApiKey", "paypingApiKey", "sepalApiKey"].includes(k) ? "[configured]" : v;
      await db.insert(settings).values({ key: k, value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } });
    }
    await audit(db, { userId: u.id, ...m }, "settings.update", "settings", null, null, changes);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/users", handler: async (req, _p, m) => {
    const u = await requireApi("USERS_MANAGE");
    const b = await body(req);
    const role = String(b.role);
    if (!(role in ROLES) || role === "seller") throw new HttpError(400, "نقش نامعتبر");
    const phone = str(b.phone, 20), password = str(b.password, 100);
    if (!/^09\d{9}$/.test(phone) || password.length < 8) throw new HttpError(400, "موبایل یا رمز نامعتبر");
    const [nu] = await db.insert(users).values({ name: str(b.name, 100) || phone, phone, role, passwordHash: hashPassword(password) }).returning({ id: users.id });
    await audit(db, { userId: u.id, ...m }, "user.create", "user", nu.id, null, { role });
    return nu;
  } },
  { method: "POST", pattern: "admin/users/:id", handler: async (req, p, m) => {
    const u = await requireApi("USERS_MANAGE");
    const b = await body(req);
    const id = idParam(p.id);
    const [old] = await db.select().from(users).where(eq(users.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    if (id === u.id && b.isActive === false) throw new HttpError(400, "نمی‌توانید حساب خود را غیرفعال کنید");
    const patch = {
      role: typeof b.role === "string" && b.role in ROLES && old.role !== "seller" && b.role !== "seller" ? b.role : old.role,
      isActive: b.isActive !== undefined ? b.isActive === true : old.isActive,
      extraPermissions: Array.isArray(b.extraPermissions) ? (b.extraPermissions as string[]).filter((x) => (PERMISSIONS as readonly string[]).includes(x)) : old.extraPermissions,
    };
    await db.update(users).set(patch).where(eq(users.id, id));
    await audit(db, { userId: u.id, ...m }, "user.permissions_change", "user", id, { role: old.role, isActive: old.isActive, extra: old.extraPermissions }, patch);
    return { ok: true };
  } },
];
