import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { JsonForm } from "@/components/client";
import { CustomerIdentityForm, type CustomerIdentity } from "@/components/CustomerIdentityForm";
import { ProfileAvatarUploader } from "@/components/ProfileAvatarUploader";

export default async function Profile() {
  const u = await requirePage();
  const [row] = await db.select().from(users).where(eq(users.id, u.id));
  return (
    <>
      <PageHeader title="پروفایل و امنیت" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="اطلاعات حساب">
          <div className="mb-6"><ProfileAvatarUploader initial={row.avatarMediaId} /></div>
          <CustomerIdentityForm initial={{name:row.name,email:row.email,birthdate:row.birthdate?.toISOString()??null,nationalId:row.nationalId,companyName:row.companyName,companyNationalId:row.companyNationalId,companyManager:row.companyManager,smsConsent:row.smsConsent} as CustomerIdentity} />
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
