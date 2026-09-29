import { notFound } from "next/navigation";
import { eq, and, desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, ticketDepartments, tickets, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { TicketThread } from "@/components/TicketThread";
import { ActionButton, JsonForm } from "@/components/client";
import { TICKET_STATUS, jdate } from "@/lib/util";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "TICKETS_MANAGE" });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
  if (!t) notFound();
  const staff = await db.select({ id: users.id, name: users.name }).from(users).where(and(ne(users.role, "customer"), ne(users.role, "seller")));
  const deps = await db.select().from(ticketDepartments).where(eq(ticketDepartments.isActive, true)).orderBy(ticketDepartments.sortOrder);
  const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.entity, "ticket"), eq(auditLogs.entityId, String(id)))).orderBy(desc(auditLogs.createdAt));
  return (
    <>
      <PageHeader title={`تیکت ${t.number}`} actions={t.status === "closed"
        ? <ActionButton url={`/api/admin/tickets/${id}`} data={{ status: "open" }} className="btn-success">باز کردن مجدد تیکت</ActionButton>
        : <ActionButton url={`/api/admin/tickets/${id}`} data={{ status: "closed" }} confirm="تیکت بسته شود؟" className="btn-danger">بستن تیکت</ActionButton>} />
      <TicketThread ticketId={id} staff />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="مدیریت تیکت">
          <JsonForm url={`/api/admin/tickets/${id}`} submit="ذخیره" resetOnDone={false} fields={[
            { name: "status", label: "وضعیت", type: "select", half: true, defaultValue: t.status, options: Object.entries(TICKET_STATUS) },
            { name: "priority", label: "اولویت", type: "select", half: true, defaultValue: t.priority, options: [["low", "کم"], ["normal", "عادی"], ["high", "بالا"], ["urgent", "فوری"]] },
            { name: "assigneeId", label: "ارجاع به کارشناس", type: "select", defaultValue: String(t.assigneeId ?? ""), options: [["", "—"], ...staff.map((s) => [String(s.id), s.name] as [string, string])] },
          ]} />
        </Card>
        <Card title="ارجاع تیکت به دپارتمان / کارشناس">
          <JsonForm url={`/api/admin/tickets/${id}/refer`} submit="ارجاع" resetOnDone={false} fields={[
            { name: "department", label: "دپارتمان مقصد", type: "select", defaultValue: t.department, options: deps.map((d) => [d.key, d.name] as [string, string]) },
            { name: "assigneeId", label: "کارشناس", type: "select", defaultValue: String(t.assigneeId ?? ""), options: [["", "— بدون کارشناس —"], ...staff.map((s) => [String(s.id), s.name] as [string, string])] },
          ]} />
        </Card>
        <Card title="تاریخچه اقدامات">{logs.map((l) => <div key={l.id} className="flex justify-between py-1 text-xs"><span dir="ltr">{l.action}</span><span className="text-slate-400">{jdate(l.createdAt, true)}</span></div>)}</Card>
      </div>
    </>
  );
}
