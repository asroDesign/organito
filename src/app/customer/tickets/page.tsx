import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, ticketDepartments, tickets } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { JsonForm } from "@/components/client";
import { TICKET_STATUS, jdate } from "@/lib/util";

export default async function CustomerTickets() {
  const u = await requirePage();
  const [list, myOrders, deps] = await Promise.all([
    db.select().from(tickets).where(eq(tickets.customerId, u.id)).orderBy(desc(tickets.updatedAt)),
    db.select({ id: orders.id, number: orders.number }).from(orders).where(eq(orders.customerId, u.id)),
    db.select().from(ticketDepartments).where(eq(ticketDepartments.isActive, true)).orderBy(asc(ticketDepartments.sortOrder)),
  ]);
  const depName = new Map(deps.map((d) => [d.key, d.name]));
  return (
    <>
      <PageHeader title="پشتیبانی" subtitle="تیکت‌های شما" />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card title="تیکت جدید">
          <JsonForm url="/api/tickets" submit="ارسال تیکت" redirectTo="/customer/tickets/:id" fields={[
            { name: "subject", label: "موضوع", required: true },
            { name: "department", label: "دپارتمان", type: "select", half: true, required: true, options: deps.map((d) => [d.key, d.name] as [string, string]) },
            { name: "priority", label: "اولویت", type: "select", half: true, defaultValue: "normal", options: [["low", "کم"], ["normal", "عادی"], ["high", "بالا"], ["urgent", "فوری"]] },
            { name: "orderId", label: "سفارش مرتبط", type: "select", options: [["", "—"], ...myOrders.map((o) => [String(o.id), o.number] as [string, string])] },
            { name: "body", label: "متن پیام", type: "textarea", required: true },
          ]} />
        </Card>
        {list.length === 0 ? <Empty title="تیکتی ندارید" /> : (
          <Table head={["شماره", "موضوع", "دپارتمان", "وضعیت", "به‌روزرسانی", ""]}>
            {list.map((t) => <tr key={t.id}><Td>{t.number}</Td><Td>{t.subject}</Td><Td>{depName.get(t.department) ?? t.department}</Td><Td><StatusBadge status={t.status} map={TICKET_STATUS} /></Td><Td>{jdate(t.updatedAt)}</Td><Td><Link href={`/customer/tickets/${t.id}`} className="btn-sm">مشاهده</Link></Td></tr>)}
          </Table>
        )}
      </div>
    </>
  );
}
