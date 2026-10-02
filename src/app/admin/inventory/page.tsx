import { desc, eq, sql } from "drizzle-orm";
import { Boxes, AlertTriangle, Coins } from "lucide-react";
import { db } from "@/db";
import { productVariants, products, stockMovements } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Stat, Table, Td } from "@/components/ui";
import { InventoryProductPicker } from "@/components/InventoryProductPicker";
import { InventoryRepackPicker } from "@/components/InventoryRepackPicker";
import { faNum, jdate, toman } from "@/lib/util";

export default async function Inventory() {
  await requirePage({ perm: "INVENTORY_MANAGE" });
  const list = await db.select().from(products).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa);
  const variants = await db.select({ v: productVariants, p: products }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa, productVariants.title);
  const variantProductIds = new Set(variants.map(({ p }) => p.id));
  const choices = [
    ...variants.map(({ v, p }) => ({ productId: p.id, variantId: v.id, name: p.nameFa, variant: v.title, sku: v.sku, unit: v.inventoryUnit, baseUnit: p.inventoryBaseUnit, baseUnitAmount: v.baseUnitAmount, onHand: v.onHand, reserved: v.reserved, unitCost: v.costPrice ?? p.avgCost, lowStockThreshold: p.lowStockThreshold })),
    ...list.filter((p) => !variantProductIds.has(p.id)).map((p) => ({ productId: p.id, variantId: null, name: p.nameFa, variant: null, sku: p.sku, unit: p.inventoryBaseUnit, baseUnit: p.inventoryBaseUnit, baseUnitAmount: 1, onHand: p.onHand, reserved: p.reserved, unitCost: p.avgCost, lowStockThreshold: p.lowStockThreshold })),
  ];
  const moves = await db.select({ m: stockMovements, name: products.nameFa, variant: productVariants.title, unit: productVariants.inventoryUnit, baseUnit: products.inventoryBaseUnit }).from(stockMovements).innerJoin(products, eq(products.id, stockMovements.productId)).leftJoin(productVariants, eq(productVariants.id, stockMovements.variantId)).orderBy(desc(stockMovements.createdAt)).limit(35);
  const value = choices.reduce((sum, row) => sum + row.onHand * row.unitCost, 0);
  const low = choices.filter((row) => (row.onHand - row.reserved) * row.baseUnitAmount <= row.lowStockThreshold);
  const repackProducts = list.map((p) => ({ productId: p.id, name: p.nameFa, baseUnit: p.inventoryBaseUnit, variants: variants.filter((x) => x.p.id === p.id && x.v.isActive).map(({ v }) => ({ id: v.id, title: v.title, sku: v.sku, inventoryUnit: v.inventoryUnit, baseUnitAmount: v.baseUnitAmount, onHand: v.onHand, reserved: v.reserved })) })).filter((p) => p.variants.length > 1);
  return (
    <>
      <PageHeader title="انبار مرکزی" subtitle="موجودی، رزرو، میانگین موزون و ثبت رسید خرید با هزینه حمل و گمرک" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="تنوع‌های قابل مدیریت" value={faNum(choices.length)} icon={Boxes} />
        <Stat label="ارزش موجودی (بهای تمام‌شده)" value={toman(value)} icon={Coins} tone="green" />
        <Stat label="زیر حد هشدار" value={faNum(low.length)} icon={AlertTriangle} tone="red" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Table head={["کالا / تنوع", "واحد", "موجودی", "رزرو", "آزاد", "بهای واحد", "ارزش"]}>
          {choices.map((row) => <tr key={`${row.productId}:${row.variantId ?? 0}`} className={(row.onHand - row.reserved) * row.baseUnitAmount <= row.lowStockThreshold ? "bg-rose-50/50" : ""}><Td><b>{row.name}{row.variant ? ` · ${row.variant}` : ""}</b><div className="text-xs text-slate-500" dir="ltr">{row.sku}</div></Td><Td>{row.unit}</Td><Td>{faNum(row.onHand)}</Td><Td>{faNum(row.reserved)}</Td><Td><b>{faNum(row.onHand - row.reserved)}</b></Td><Td>{toman(row.unitCost)}</Td><Td>{toman(row.unitCost * row.onHand)}</Td></tr>)}
        </Table>
        <Card title="ثبت رسید خرید / تعدیل">
          <InventoryProductPicker items={choices} />
        </Card>
      </div>
      <Card title="بسته‌بندی / تبدیل فله به تنوع آماده فروش" className="mt-6">
        <InventoryRepackPicker products={repackProducts} />
      </Card>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">گردش موجودی (Stock Movements)</h2>
      <Table head={["تاریخ", "کالا / تنوع", "نوع", "مقدار و واحد", "بهای واحد", "مرجع"]}>
          {moves.map(({ m, name, variant, unit, baseUnit }) => <tr key={m.id}><Td>{jdate(m.createdAt, true)}</Td><Td>{name}{variant ? ` · ${variant}` : ""}</Td><Td>{({ purchase_in: "رسید خرید", adjust_out: "تعدیل خروج", sale_out: "خروج فروش / ارسال", reserve: "رزرو سفارش", release: "آزادسازی رزرو", backorder_receive: "ورود تأمین سفارش", central_pos_sale: "فروش حضوری انبار مرکزی", pos_sale: "فروش حضوری تأمین‌کننده", repack_out: "مصرف در بسته‌بندی", repack_in: "تولید بسته‌بندی" } as Record<string, string>)[m.type] ?? m.type}</Td><Td>{faNum(m.qty)} {unit ?? baseUnit}</Td><Td>{toman(m.unitCost)}</Td><Td>{m.refType} {m.refId ?? ""}</Td></tr>)}
      </Table>
    </>
  );
}
