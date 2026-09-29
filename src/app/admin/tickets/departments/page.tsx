import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { ticketDepartments } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Table, Td, Badge } from "@/components/ui";
import { ActionButton, JsonForm } from "@/components/client";
import { DepartmentRename } from "@/components/DepartmentRename";

export default async function TicketDepartments() {
  await requirePage({ perm: "TICKETS_MANAGE" });
  const deps = await db.select({ d: ticketDepartments, n: sql<number>`(select count(*) from tickets t where t.department = ${ticketDepartments.key})::int` }).from(ticketDepartments).orderBy(asc(ticketDepartments.sortOrder));
  return (
    <>
      <PageHeader title="تنظیمات ماژول تیکت — دپارتمان‌ها" subtitle="دپارتمان‌های فعال در فرم ایجاد تیکت مشتری نمایش داده می‌شوند" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Table head={["ترتیب", "نام", "کلید", "توضیح", "تیکت‌ها", "وضعیت", ""]}>
          {deps.map(({ d, n }) => (
            <tr key={d.id} className={d.isActive ? "" : "opacity-50"}>
              <Td>{d.sortOrder.toLocaleString("fa-IR")}</Td><Td><b>{d.name}</b></Td><Td><code dir="ltr" className="text-xs">{d.key}</code></Td><Td className="text-xs text-slate-500">{d.description ?? "—"}</Td>
              <Td>{n.toLocaleString("fa-IR")}</Td><Td>{d.isActive ? <Badge tone="green">فعال</Badge> : <Badge>غیرفعال</Badge>}</Td>
              <Td><div className="flex gap-1"><DepartmentRename id={d.id} name={d.name} description={d.description ?? ""} sortOrder={d.sortOrder} />
                <ActionButton url={`/api/admin/ticket-departments/${d.id}`} data={{ isActive: !d.isActive }} className="btn-sm">{d.isActive ? "غیرفعال" : "فعال"}</ActionButton></div></Td>
            </tr>
          ))}
        </Table>
        <Card title="افزودن دپارتمان">
          <JsonForm url="/api/admin/ticket-departments" submit="افزودن" fields={[
            { name: "name", label: "نام دپارتمان", required: true },
            { name: "key", label: "کلید انگلیسی (اختیاری)", placeholder: "warranty" },
            { name: "sortOrder", label: "ترتیب نمایش", type: "number", defaultValue: 10 },
            { name: "description", label: "توضیح", type: "textarea" },
          ]} />
        </Card>
      </div>
    </>
  );
}
