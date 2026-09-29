import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Table, Td, Badge } from "@/components/ui";
import { JsonForm } from "@/components/client";
import { UserRow } from "@/components/UserRow";
import { ROLES, permissionsOf, PERMISSIONS } from "@/lib/rbac";
import { jdate } from "@/lib/util";

export default async function UsersPage() {
  const me = await requirePage({ perm: "USERS_MANAGE" });
  const list = await db.select().from(users).orderBy(desc(users.createdAt));
  const roleOpts = Object.entries(ROLES).filter(([k]) => k !== "seller") as [string, string][];
  return (
    <>
      <PageHeader title="کاربران، نقش‌ها و مجوزها" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Table head={["کاربر", "موبایل", "نقش", "مجوزها", "عضویت", "مدیریت"]}>
          {list.map((u) => (
            <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
              <Td><b>{u.name}</b></Td><Td><span dir="ltr">{u.phone}</span></Td><Td><Badge tone="blue">{ROLES[u.role as keyof typeof ROLES]}</Badge></Td>
              <Td><span className="text-xs text-slate-500">{permissionsOf(u.role, u.extraPermissions).length} مجوز</span></Td><Td className="text-xs">{jdate(u.createdAt)}</Td>
              <Td><UserRow id={u.id} role={u.role} active={u.isActive} extra={u.extraPermissions} roles={roleOpts} perms={[...PERMISSIONS]} self={u.id === me.id} /></Td>
            </tr>
          ))}
        </Table>
        <Card title="افزودن کاربر سازمانی">
          <JsonForm url="/api/admin/users" submit="ایجاد" fields={[
            { name: "name", label: "نام", required: true }, { name: "phone", label: "موبایل", required: true },
            { name: "role", label: "نقش", type: "select", options: roleOpts }, { name: "password", label: "رمز عبور (حداقل ۸)", type: "password", required: true },
          ]} />
        </Card>
      </div>
    </>
  );
}
