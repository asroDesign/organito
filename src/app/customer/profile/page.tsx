import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client";

export default async function Profile() {
  const u = await requirePage();
  const [row] = await db.select().from(users).where(eq(users.id, u.id));
  return (
    <>
      <PageHeader title="پروفایل و امنیت" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="اطلاعات حساب">
          <JsonForm url="/api/me/profile" submit="ذخیره" resetOnDone={false} fields={[
            { name: "name", label: "نام و نام خانوادگی", required: true, defaultValue: row.name },
            { name: "email", label: "ایمیل", defaultValue: row.email ?? "" },
          ]} />
          <p className="mt-3 text-xs text-slate-500">شماره موبایل: <span dir="ltr">{row.phone}</span> (قابل تغییر از طریق پشتیبانی)</p>
        </Card>
        <Card title="تغییر رمز عبور">
          <JsonForm url="/api/me/password" submit="تغییر رمز" fields={[
            { name: "current", label: "رمز فعلی", type: "password", required: true },
            { name: "next", label: "رمز جدید (حداقل ۸ کاراکتر)", type: "password", required: true },
          ]} />
        </Card>
      </div>
    </>
  );
}
