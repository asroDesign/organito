import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketDepartments, ticketMessages, tickets, users } from "@/db/schema";
import { jdate, TICKET_STATUS } from "@/lib/util";
import { Card, KV, StatusBadge } from "./ui";
import { JsonForm } from "./client";

export async function TicketThread({ ticketId, staff }: { ticketId: number; staff: boolean }) {
  const [t] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  const msgs = await db.select({ m: ticketMessages, name: users.name, role: users.role }).from(ticketMessages).innerJoin(users, eq(users.id, ticketMessages.userId))
    .where(eq(ticketMessages.ticketId, ticketId)).orderBy(asc(ticketMessages.createdAt));
  const [dep] = await db.select().from(ticketDepartments).where(eq(ticketDepartments.key, t.department));
  const [assignee] = t.assigneeId ? await db.select({ name: users.name }).from(users).where(eq(users.id, t.assigneeId)) : [];
  const visible = staff ? msgs : msgs.filter((x) => !x.m.isInternal);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card title={t.subject}>
        <div className="space-y-3">
          {visible.map(({ m, name, role }) => (
            <div key={m.id} className={`rounded-2xl p-3 text-sm ${m.isInternal ? "border border-dashed border-amber-300 bg-amber-50" : role === "customer" ? "bg-slate-100" : "bg-emerald-50"}`}>
              <div className="mb-1 flex justify-between text-xs text-slate-500"><b>{name}{m.isInternal && " · یادداشت داخلی"}</b><span>{jdate(m.createdAt, true)}</span></div>
              <p className="whitespace-pre-line leading-7">{m.body}</p>
            </div>
          ))}
        </div>
        {t.status === "closed" && <div className="mt-4 rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-500">این تیکت بسته شده است.</div>}
        {t.status !== "closed" && <div className="mt-4 border-t pt-4"><JsonForm url={`/api/tickets/${ticketId}/messages`} submit="ارسال پاسخ" fields={[{ name: "body", label: "پیام", type: "textarea", required: true }, ...(staff ? [{ name: "isInternal", label: "یادداشت داخلی (برای مشتری نمایش داده نمی‌شود)", type: "checkbox" as const }] : [])]} /></div>}
      </Card>
      <Card title="اطلاعات تیکت">
        <KV k="شماره" v={t.number} /><KV k="وضعیت" v={<StatusBadge status={t.status} map={TICKET_STATUS} />} /><KV k="دپارتمان" v={dep?.name ?? t.department} /><KV k="کارشناس" v={assignee?.name ?? "—"} /><KV k="اولویت" v={t.priority} />
        <KV k="سفارش مرتبط" v={t.orderId ?? "—"} /><KV k="ایجاد" v={jdate(t.createdAt, true)} />
      </Card>
    </div>
  );
}
