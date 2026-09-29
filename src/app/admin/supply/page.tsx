import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supplyRequests, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, StatusBadge, Table, Td, Badge } from "@/components/ui";
import { SUPPLY_STATUS, faNum, jdate, toman } from "@/lib/util";

export default async function AdminSupply({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePage({ perm: "SUPPLY_REQUESTS_VIEW" });
  const sp = await searchParams;
  const list = await db.select({ r: supplyRequests, name: users.name }).from(supplyRequests).innerJoin(users, eq(users.id, supplyRequests.customerId))
    .where(sp.status ? eq(supplyRequests.status, sp.status) : undefined).orderBy(desc(supplyRequests.updatedAt));
  return (
    <>
      <PageHeader title="سیستم متمرکز استعلام و تأمین کد محصول" subtitle="از درخواست تا RFQ، پیش‌فاکتور، پرداخت، خرید و تحویل" />
      <form className="mb-4 flex gap-2"><select name="status" defaultValue={sp.status ?? ""} className="input !w-56"><option value="">همه وضعیت‌ها</option>{Object.entries(SUPPLY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn-ghost">فیلتر</button></form>
      <Table head={["شماره", "مشتری", "محصول", "محصول", "اولویت", "وضعیت", "مبلغ", ""]} empty={!list.length}>
        {list.map(({ r, name }) => <tr key={r.id} className="hover:bg-slate-50"><Td><b dir="ltr">{r.number}</b><div className="text-[11px] text-slate-400">{jdate(r.createdAt)}</div></Td><Td>{name}</Td>
          <Td>{r.partName || "—"}<div className="text-xs text-slate-500" dir="ltr">{r.partNumber || r.vin}</div></Td><Td>{r.carMake} {r.carModel} {r.carYear}</Td>
          <Td><Badge tone={r.priority === "urgent" || r.priority === "high" ? "red" : "gray"}>{r.priority}</Badge></Td><Td><StatusBadge status={r.status} map={SUPPLY_STATUS} /></Td>
          <Td>{r.quotationTotal ? toman(r.quotationTotal) : "—"} <span className="text-xs text-slate-400">×{faNum(r.qty)}</span></Td><Td><Link href={`/admin/supply/${r.id}`} className="btn-sm">مدیریت</Link></Td></tr>)}
      </Table>
    </>
  );
}
