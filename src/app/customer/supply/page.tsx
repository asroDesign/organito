import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supplyRequests } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { SupplyForm } from "@/components/SupplyForm";
import { SUPPLY_STATUS, jdate, toman, faNum } from "@/lib/util";

export default async function CustomerSupply({ searchParams }: { searchParams: Promise<{ pn?: string }> }) {
  const u = await requirePage();
  const { pn } = await searchParams;
  const list = await db.select().from(supplyRequests).where(eq(supplyRequests.customerId, u.id)).orderBy(desc(supplyRequests.createdAt));
  return (
    <>
      <PageHeader title="استعلام و تأمین محصول" subtitle="با کد محصول، نام و برند، بارکد یا تصویر محصول درخواست ثبت کنید؛ کارشناسان ما از میان تأمین‌کنندگان بهترین پیشنهاد را می‌یابند." />
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card title="درخواست جدید"><SupplyForm defaultPn={pn ?? ""} /></Card>
        <div>
          {list.length === 0 ? <Empty title="درخواستی ثبت نشده است" /> : (
            <Table head={["شماره", "محصول", "تعداد", "وضعیت", "پیش‌فاکتور", ""]}>
              {list.map((r) => (
                <tr key={r.id}><Td><b dir="ltr">{r.number}</b><div className="text-[11px] text-slate-400">{jdate(r.createdAt)}</div></Td>
                  <Td>{r.partName || "—"}<div className="text-xs text-slate-500" dir="ltr">{r.partNumber || r.vin}</div></Td><Td>{faNum(r.qty)}</Td>
                  <Td><StatusBadge status={r.status} map={SUPPLY_STATUS} /></Td><Td>{r.quotationTotal ? toman(r.quotationTotal) : "—"}</Td>
                  <Td><Link href={`/customer/supply/${r.id}`} className="btn-sm">مشاهده</Link></Td></tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
