import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader, Table, Td } from "@/components/ui";
import { jdate } from "@/lib/util";

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string }> }) {
  await requirePage({ perm: "AUDIT_LOG_VIEW" });
  const sp = await searchParams;
  const conds: SQL[] = [];
  if (sp.action) conds.push(ilike(auditLogs.action, `%${sp.action}%`));
  if (sp.entity) conds.push(eq(auditLogs.entity, sp.entity));
  const list = await db.select({ a: auditLogs, name: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId)).where(conds.length ? and(...conds) : undefined).orderBy(desc(auditLogs.createdAt)).limit(200);
  return (
    <>
      <PageHeader title="ممیزی (Audit Log)" subtitle="اطلاعات محرمانه به‌صورت خودکار حذف/Mask می‌شوند" />
      <form className="mb-4 flex flex-wrap gap-2"><input name="action" defaultValue={sp.action} placeholder="Action (مثلاً order)" className="input !w-52" dir="ltr" /><input name="entity" defaultValue={sp.entity} placeholder="Entity" className="input !w-40" dir="ltr" /><button className="btn-ghost">فیلتر</button></form>
      <Table head={["زمان", "کاربر", "Action", "Entity", "مقدار قبلی", "مقدار جدید", "IP / UA"]} empty={!list.length}>
        {list.map(({ a, name }) => (
          <tr key={a.id} className="align-top text-xs">
            <Td>{jdate(a.createdAt, true)}</Td><Td>{name ?? "سیستم"}</Td><Td><code dir="ltr">{a.action}</code></Td><Td>{a.entity}#{a.entityId}</Td>
            <Td><pre className="max-w-52 overflow-hidden whitespace-pre-wrap break-all text-[10px] text-slate-500" dir="ltr">{a.oldValue ? JSON.stringify(a.oldValue).slice(0, 200) : "—"}</pre></Td>
            <Td><pre className="max-w-52 overflow-hidden whitespace-pre-wrap break-all text-[10px]" dir="ltr">{a.newValue ? JSON.stringify(a.newValue).slice(0, 200) : "—"}</pre></Td>
            <Td><div dir="ltr">{a.ip}</div><div className="max-w-40 truncate text-[10px] text-slate-400" dir="ltr">{a.userAgent}</div></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
