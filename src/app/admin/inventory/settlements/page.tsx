import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, inventoryParties, inventoryReceipts, inventorySupplierPayments, journalLines, productVariants, products } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Table, Td } from "@/components/ui";
import { InventorySettlementForm } from "@/components/InventorySettlementForm";
import { faNum, jdate, toman } from "@/lib/util";

export default async function InventorySettlements() {
  await requirePage({ perm: "INVENTORY_MANAGE" });
  const parties = await db.select().from(inventoryParties).orderBy(inventoryParties.name);
  const balances = await db.select({ detailId: journalLines.detail1Id, balance: sql<number>`coalesce(sum(${journalLines.credit} - ${journalLines.debit}),0)` })
    .from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(eq(accounts.code, "2104")).groupBy(journalLines.detail1Id);
  const balanceByDetail = new Map(balances.map((row) => [row.detailId, Number(row.balance)]));
  const receipts = await db.select({ receipt: inventoryReceipts, party: inventoryParties.name, product: products.nameFa, variant: productVariants.title })
    .from(inventoryReceipts).innerJoin(inventoryParties, eq(inventoryParties.id, inventoryReceipts.partyId)).innerJoin(products, eq(products.id, inventoryReceipts.productId)).leftJoin(productVariants, eq(productVariants.id, inventoryReceipts.variantId)).orderBy(desc(inventoryReceipts.createdAt)).limit(100);
  const payments = await db.select({ payment: inventorySupplierPayments, party: inventoryParties.name }).from(inventorySupplierPayments)
    .innerJoin(inventoryParties, eq(inventoryParties.id, inventorySupplierPayments.partyId)).orderBy(desc(inventorySupplierPayments.createdAt)).limit(100);
  return <>
    <PageHeader title="تسویه حساب تولیدکنندگان و صاحبان کالا" subtitle="مانده از حساب تفصیلی اسناد خرید و فروش کالای امانی محاسبه می‌شود" actions={<Link href="/admin/inventory" className="btn-ghost">بازگشت به انبار</Link>} />
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      {parties.map((party) => {
        const balance = balanceByDetail.get(party.detailAccountId) ?? 0;
        return <Card key={party.id} title={party.name} action={<span className={`font-bold ${balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>مانده بستانکار: {toman(balance)}</span>}>
          <div className="mb-3 text-xs text-slate-500">{party.phone || "بدون شماره تماس"} · حساب تفصیلی {party.detailAccountId ? faNum(party.detailAccountId) : "تعریف‌نشده"}</div>
          {balance > 0 ? <InventorySettlementForm partyId={party.id} balance={balance} /> : <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">در حال حاضر بدهی ثبت‌شده‌ای برای تسویه ندارد.</p>}
        </Card>;
      })}
      {!parties.length && <Card title="تولیدکننده‌ای ثبت نشده است"><p className="text-sm text-slate-500">ابتدا از صفحه انبار مرکزی تولیدکننده یا صاحب کالا را تعریف کنید.</p></Card>}
    </div>
    <Card title="رسیدهای خرید و امانی اخیر">
      <Table head={["تاریخ", "شماره داخلی / فاکتور", "نوع", "صاحب کالا", "کالا / تنوع", "مقدار", "جمع", "پرداخت اولیه / پیگیری"]} empty={!receipts.length}>
        {receipts.map(({ receipt: r, party, product, variant }) => <tr key={r.id}><Td>{jdate(r.createdAt, true)}</Td><Td>{r.documentId?<Link href={`/print/inventory-document/${r.documentId}`} className="text-amber-700 underline">{r.number} · صورتحساب</Link>:r.number}<div className="text-xs text-slate-500">{r.invoiceNumber || "بدون شماره فاکتور"}</div></Td><Td>{r.type === "consignment" ? "امانی" : "خرید"}</Td><Td>{party}</Td><Td>{product}{variant ? ` · ${variant}` : ""}</Td><Td>{faNum(r.quantity)}</Td><Td>{toman(r.total)}</Td><Td>{r.paymentLocation || "—"}{r.paidAmount > 0 && <div className="text-xs text-slate-500">{toman(r.paidAmount)} · {r.paymentTrackingNumber || "بدون پیگیری"}</div>}</Td></tr>)}
      </Table>
    </Card>
    <Card title="پرداخت‌ها و تسویه‌های ثبت‌شده" className="mt-6">
      <Table head={["تاریخ", "طرف حساب", "مبلغ", "محل پرداخت", "شماره پیگیری", "شرح"]} empty={!payments.length}>
        {payments.map(({ payment: p, party }) => <tr key={p.id}><Td>{jdate(p.createdAt, true)}</Td><Td>{party}</Td><Td>{toman(p.amount)}</Td><Td>{p.paymentLocation}</Td><Td>{p.trackingNumber || "—"}</Td><Td>{p.note || "—"}</Td></tr>)}
      </Table>
    </Card>
  </>;
}
