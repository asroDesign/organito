import { desc, eq, sql } from "drizzle-orm";
import { Boxes, AlertTriangle, Coins } from "lucide-react";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Stat, Table, Td } from "@/components/ui";
import { InvClient } from "@/components/InvClient";
import { faNum, jdate, toman } from "@/lib/util";

export default async function Inventory() {
  await requirePage({ perm: "INVENTORY_MANAGE" });
  const list = await db.select().from(products).where(sql`${products.source} = 'central' and ${products.status} <> 'deleted'`).orderBy(products.nameFa);
  const moves = await db.select({ m: stockMovements, name: products.nameFa }).from(stockMovements).innerJoin(products, eq(products.id, stockMovements.productId)).orderBy(desc(stockMovements.createdAt)).limit(25);
  const value = list.reduce((a, p) => a + p.onHand * p.avgCost, 0);
  const low = list.filter((p) => p.onHand - p.reserved <= p.lowStockThreshold);
  return (
    <>
      <PageHeader title="انبار مرکزی" subtitle="موجودی، رزرو، میانگین موزون و ثبت رسید خرید با هزینه حمل و گمرک" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="اقلام" value={faNum(list.length)} icon={Boxes} />
        <Stat label="ارزش موجودی (بهای تمام‌شده)" value={toman(value)} icon={Coins} tone="green" />
        <Stat label="زیر حد هشدار" value={faNum(low.length)} icon={AlertTriangle} tone="red" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Table head={["کالا", "موجودی", "رزرو", "آزاد", "میانگین خرید", "ارزش"]}>
          {list.map((p) => <tr key={p.id} className={p.onHand - p.reserved <= p.lowStockThreshold ? "bg-rose-50/50" : ""}><Td><b>{p.nameFa}</b><div className="text-xs text-slate-500" dir="ltr">{p.sku}</div></Td><Td>{faNum(p.onHand)}</Td><Td>{faNum(p.reserved)}</Td><Td><b>{faNum(p.onHand - p.reserved)}</b></Td><Td>{toman(p.avgCost)}</Td><Td>{toman(p.avgCost * p.onHand)}</Td></tr>)}
        </Table>
        <Card title="ثبت رسید خرید / تعدیل">
          <InventoryForm items={list.map((p) => [String(p.id), p.nameFa])} />
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">گردش موجودی (Stock Movements)</h2>
      <Table head={["تاریخ", "کالا", "نوع", "تعداد", "بهای واحد", "مرجع"]}>
        {moves.map(({ m, name }) => <tr key={m.id}><Td>{jdate(m.createdAt, true)}</Td><Td>{name}</Td><Td>{m.type === "central_pos_sale" ? "فروش حضوری انبار مرکزی" : m.type === "pos_sale" ? "فروش حضوری تأمین‌کننده" : m.type}</Td><Td>{faNum(m.qty)}</Td><Td>{toman(m.unitCost)}</Td><Td>{m.refType} {m.refId ?? ""}</Td></tr>)}
      </Table>
    </>
  );
}

function InventoryForm({ items }: { items: [string, string][] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">برای کسری/ضایعات، تعداد منفی وارد کنید. میانگین موزون = (موجودی×میانگین + تعداد×قیمت + حمل + گمرک) ÷ موجودی جدید</p>
      <InvClient items={items} />
    </div>
  );
}
