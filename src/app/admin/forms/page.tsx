import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { publicForms, publicFormSubmissions } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { PublicFormManager } from "@/components/PublicFormManager";
import { ClipboardList } from "lucide-react";

export default async function AdminFormsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  let records: (typeof publicForms.$inferSelect)[] = [];
  let counts: { formId: number; total: number }[] = [];
  let databaseReady = true;
  try {
    [records, counts] = await Promise.all([
      db.select().from(publicForms).orderBy(desc(publicForms.updatedAt)).limit(500),
      db.select({ formId: publicFormSubmissions.formId, total: sql<number>`count(*)::int` }).from(publicFormSubmissions).groupBy(publicFormSubmissions.formId),
    ]);
  } catch (error) {
    console.error("Unable to load public forms; showing the editor preview without database writes.", error);
    databaseReady = false;
  }
  const countByForm = new Map(counts.map((row) => [row.formId, row.total]));
  const initial = records.map((form) => ({ ...form, responseCount: countByForm.get(form.id) ?? 0 }));
  return <><PageHeader title="فرم‌های عمومی" subtitle="ساخت فرم، انتشار پیوند و مدیریت پاسخ‌ها"/><FeatureIntro className="my-5" icon={ClipboardList} title="فرم‌ساز" text={databaseReady ? "فیلدها و اعتبارسنجی سمت سرور تعریف کنید، فرم را منتشر کنید و پاسخ‌ها را با حفظ برچسب‌های زمان ثبت مرور یا به CSV دریافت کنید. نشانی IP در پاسخ فرم ذخیره نمی‌شود." : "دموی رابط در دسترس است. برای ذخیره فرم و ثبت پاسخ‌ها، migration افزایشی 0048_public_forms.sql باید روی پایگاه داده اجرا شود."} tone={databaseReady ? "green" : "yellow"}/><PublicFormManager initial={initial} databaseReady={databaseReady}/></>;
}
