import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketDepartments, tickets, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, StatusBadge, Table, Td, Badge } from "@/components/ui";
import { TICKET_STATUS, jdate } from "@/lib/util";

export default async function AdminTickets({ searchParams }: { searchParams: Promise<{ status?: string; department?: string }> }) {
  await requirePage({ perm: "TICKETS_MANAGE" });
  const sp = await searchParams;
  const deps = new Map((await db.select().from(ticketDepartments)).map((d) => [d.key, d.name]));
  const list = await db.select({ t: tickets, name: users.name }).from(tickets).innerJoin(users, eq(users.id, tickets.customerId)).where(and(sp.status ? eq(tickets.status, sp.status) : undefined, sp.department ? eq(tickets.department, sp.department) : undefined)).orderBy(desc(tickets.updatedAt));
  return (
    <>
      <PageHeader title="مرکز تیکت و پشتیبانی" actions={<Link href="/admin/tickets/departments" className="btn-ghost">تنظیمات دپارتمان‌ها</Link>} />
      <form className="mb-4 flex flex-wrap gap-2"><select name="department" defaultValue={sp.department ?? ""} className="input !w-48"><option value="">همه دپارتمان‌ها</option>{[...deps].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select name="status" defaultValue={sp.status ?? ""} className="input !w-48"><option value="">همه</option>{Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn-ghost">فیلتر</button></form>
      <Table head={["شماره", "مشتری", "موضوع", "دپارتمان", "اولویت", "وضعیت", "به‌روزرسانی", ""]} empty={!list.length}>
        {list.map(({ t, name }) => <tr key={t.id}><Td>{t.number}</Td><Td>{name}</Td><Td>{t.subject}</Td><Td>{deps.get(t.department) ?? t.department}</Td><Td><Badge tone={t.priority === "high" || t.priority === "urgent" ? "red" : "gray"}>{t.priority}</Badge></Td><Td><StatusBadge status={t.status} map={TICKET_STATUS} /></Td><Td>{jdate(t.updatedAt, true)}</Td><Td><Link href={`/admin/tickets/${t.id}`} className="btn-sm">پاسخ</Link></Td></tr>)}
      </Table>
    </>
  );
}
