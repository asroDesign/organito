import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Boxes, AlertTriangle, Coins } from "lucide-react";
import { db } from "@/db";
import { inventoryConsignmentLots, inventoryParties, inventoryWarehouses, productVariants, products, stockMovements } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { paginationParams } from "@/lib/pagination";
import { Card, PageHeader, Stat, Table, Td } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import { InventoryRepackPicker } from "@/components/InventoryRepackPicker";
import { InventoryProductPicker } from "@/components/InventoryProductPicker";
import { faNum, jdate, toman } from "@/lib/util";
import { InventoryWarehousesClient } from "@/components/InventoryWarehousesClient";

export default async function Inventory({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; movementPage?: string; movementPageSize?: string }> }) {
  await requirePage({ perm: "INVENTORY_MANAGE" });
  const sp = await searchParams;
  const list = await db.select().from(products).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa);
  const parties = await db.select({ id: inventoryParties.id, name: inventoryParties.name }).from(inventoryParties).where(eq(inventoryParties.enabled, true)).orderBy(inventoryParties.name);
  const variants = await db.select({ v: productVariants, p: products }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa, productVariants.title);
  const consignmentRows = await db.select({ lot: inventoryConsignmentLots, party: inventoryParties.name }).from(inventoryConsignmentLots).innerJoin(inventoryParties, eq(inventoryParties.id, inventoryConsignmentLots.partyId)).where(sql`${inventoryConsignmentLots.remainingQty} > 0 and ${inventoryConsignmentLots.warehouseId} is null`);
  const consignmentByStock = new Map<string, { name: string; quantity: number }[]>();
  for (const { lot, party } of consignmentRows) {
    const key = lot.variantId === null ? `p:${lot.productId}` : `v:${lot.variantId}`;
    const owners = consignmentByStock.get(key) ?? [];
    const existing = owners.find((owner) => owner.name === party);
    if (existing) existing.quantity += lot.remainingQty; else owners.push({ name: party, quantity: lot.remainingQty });
    consignmentByStock.set(key, owners);
  }
  const variantProductIds = new Set(variants.map(({ p }) => p.id));
  const choices = [
    ...variants.filter(({ v }) => !v.deletedAt || v.onHand !== 0 || v.reserved !== 0).map(({ v, p }) => ({ productId: p.id, variantId: v.id, name: p.nameFa, variant: v.title, sku: v.sku, unit: v.inventoryUnit, baseUnit: p.inventoryBaseUnit, baseUnitAmount: v.baseUnitAmount, onHand: v.onHand, reserved: v.reserved, unitCost: v.costPrice ?? p.avgCost, lowStockThreshold: p.lowStockThreshold, deleted: !!v.deletedAt, consignmentOwners: consignmentByStock.get(`v:${v.id}`) ?? [] })),
    ...list.filter((p) => !variantProductIds.has(p.id)).map((p) => ({ productId: p.id, variantId: null, name: p.nameFa, variant: null, sku: p.sku, unit: p.inventoryBaseUnit, baseUnit: p.inventoryBaseUnit, baseUnitAmount: 1, onHand: p.onHand, reserved: p.reserved, unitCost: p.avgCost, lowStockThreshold: p.lowStockThreshold, deleted: false, consignmentOwners: consignmentByStock.get(`p:${p.id}`) ?? [] })),
  ];
  const { pageSize } = paginationParams(sp);
  const page = Math.min(paginationParams(sp).page, Math.max(1, Math.ceil(choices.length / pageSize)));
  const visibleChoices = choices.slice((page - 1) * pageSize, page * pageSize);
  const movementTotalRows = await db.select({ total: sql<number>`count(*)::int` }).from(stockMovements);
  const movementTotal = Number(movementTotalRows[0]?.total ?? 0);
  const movementPagination = paginationParams({ page: sp.movementPage, pageSize: sp.movementPageSize });
  const movementPage = Math.min(movementPagination.page, Math.max(1, Math.ceil(movementTotal / movementPagination.pageSize)));
  const moves = await db.select({ m: stockMovements, name: products.nameFa, variant: productVariants.title, unit: productVariants.inventoryUnit, baseUnit: products.inventoryBaseUnit, warehouse: inventoryWarehouses.name }).from(stockMovements).innerJoin(products, eq(products.id, stockMovements.productId)).leftJoin(productVariants, eq(productVariants.id, stockMovements.variantId)).leftJoin(inventoryWarehouses, eq(inventoryWarehouses.id, stockMovements.warehouseId)).orderBy(desc(stockMovements.createdAt), desc(stockMovements.id)).limit(movementPagination.pageSize).offset((movementPage - 1) * movementPagination.pageSize);
  const value = choices.reduce((sum, row) => sum + Math.max(0, row.onHand - row.consignmentOwners.reduce((qty, owner) => qty + owner.quantity, 0)) * row.unitCost, 0);
  const low = choices.filter((row) => (row.onHand - row.reserved) * row.baseUnitAmount <= row.lowStockThreshold);
  const repackProducts = list.map((p) => ({ productId: p.id, name: p.nameFa, baseUnit: p.inventoryBaseUnit, variants: variants.filter((x) => x.p.id === p.id && x.v.isActive).map(({ v }) => ({ id: v.id, title: v.title, sku: v.sku, inventoryUnit: v.inventoryUnit, baseUnitAmount: v.baseUnitAmount, onHand: v.onHand, reserved: v.reserved })) })).filter((p) => p.variants.length > 1);
  return (
    <>
      <PageHeader title="انبار مرکزی" subtitle="موجودی، رسید خرید و امانی، حساب تولیدکننده و گردش کالا" actions={<Link className="btn-ghost" href="/admin/inventory/settlements">تسویه حساب تولیدکنندگان</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="تنوع‌های قابل مدیریت" value={faNum(choices.length)} icon={Boxes} />
        <Stat label="ارزش موجودی متعلق به فروشگاه" value={toman(value)} icon={Coins} tone="green" />
        <Stat label="زیر حد هشدار" value={faNum(low.length)} icon={AlertTriangle} tone="red" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          <Table head={["کالا / تنوع", "مالکیت", "واحد", "موجودی", "رزرو", "آزاد", "بهای واحد", "ارزش"]} empty={!visibleChoices.length}>
            {visibleChoices.map((row) => { const consignedQty = row.consignmentOwners.reduce((sum, owner) => sum + owner.quantity, 0); return <tr key={`${row.productId}:${row.variantId ?? 0}`} className={(row.onHand - row.reserved) * row.baseUnitAmount <= row.lowStockThreshold ? "bg-rose-50/50" : ""}><Td><b>{row.name}{row.variant ? ` · ${row.variant}` : ""}</b>{row.deleted&&<span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">حذف نرم</span>}<div className="text-xs text-slate-500" dir="ltr">{row.sku}</div></Td><Td>{consignedQty ? <div className="text-xs leading-5">{row.consignmentOwners.map((owner) => <div key={owner.name}>{owner.name}: {faNum(owner.quantity)} {row.unit} امانی</div>)}{row.onHand > consignedQty && <div className="text-slate-500">متعلق به فروشگاه: {faNum(row.onHand - consignedQty)}</div>}</div> : "متعلق به فروشگاه"}</Td><Td>{row.unit}</Td><Td>{faNum(row.onHand)}</Td><Td>{faNum(row.reserved)}</Td><Td><b>{faNum(row.onHand - row.reserved)}</b></Td><Td>{toman(row.unitCost)}</Td><Td>{toman(Math.max(0, row.onHand - consignedQty) * row.unitCost)}</Td></tr>; })}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={choices.length} />
        </div>
        <Card title="ثبت رسید خرید / تعدیل">
          <p className="mb-4 text-sm leading-7 text-slate-500">برای چند کالا یک صورتحساب مشترک ثبت کنید؛ برای یک قلم از فرم ثبت سریع استفاده کنید.</p>
          <Link className="btn-primary w-full" href="/admin/inventory/documents">ثبت صورتحساب چندقلمی</Link>
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="mb-3 text-sm font-bold">ثبت تکی و سریع</h3>
            <InventoryProductPicker items={choices} parties={parties} />
          </div>
        </Card>
      </div>
      <Card title="بسته‌بندی / تبدیل فله به تنوع آماده فروش" className="mt-6">
        <InventoryRepackPicker products={repackProducts} />
      </Card>
      <section className="mt-8"><h2 className="mb-3 text-lg font-extrabold">مدیریت چند انبار</h2><InventoryWarehousesClient /></section>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">گردش موجودی (Stock Movements)</h2>
      <Table head={["تاریخ", "کالا / تنوع", "انبار", "نوع", "مقدار و واحد", "بهای واحد", "مرجع"]}>
          {moves.map(({ m, name, variant, unit, baseUnit, warehouse }) => <tr key={m.id}><Td>{jdate(m.createdAt, true)}</Td><Td>{name}{variant ? ` · ${variant}` : ""}</Td><Td>{warehouse ?? "انبار مرکزی"}</Td><Td>{({ purchase_in: "رسید خرید", consignment_in: "دریافت امانی", adjust_in: "تعدیل ورود", adjust_out: "تعدیل خروج", sale_out: "خروج فروش / ارسال", reserve: "رزرو سفارش", release: "آزادسازی رزرو", backorder_receive: "ورود تأمین سفارش", central_pos_sale: "فروش حضوری انبار مرکزی", pos_sale: "فروش حضوری تأمین‌کننده", repack_out: "مصرف در بسته‌بندی", repack_in: "تولید بسته‌بندی", warehouse_transfer_out: "انتقال خروج", warehouse_transfer_in: "انتقال ورود" } as Record<string, string>)[m.type] ?? m.type}</Td><Td>{faNum(m.qty)} {unit ?? baseUnit}</Td><Td>{toman(m.unitCost)}</Td><Td>{m.refType === "inventory_document" && m.refId ? <Link className="text-amber-700 underline" href={`/print/inventory-document/${m.refId}`}>مشاهده سند {faNum(m.refId)}</Link> : <>{m.refType} {m.refId ?? ""}</>}</Td></tr>)}
      </Table>
      <Pagination page={movementPage} pageSize={movementPagination.pageSize} total={movementTotal} pageKey="movementPage" pageSizeKey="movementPageSize" />
    </>
  );
}
