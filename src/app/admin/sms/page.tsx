import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { smsLogs, smsTemplates } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SMS_EVENTS, renderTemplate } from "@/lib/sms";
import { Card, PageHeader, StatusBadge, Table, Td, Badge } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { SmsTemplateEditor, SmsSender } from "@/components/SmsPanel";
import { jdate, maskPhone } from "@/lib/util";
import { JsonForm } from "@/components/client";

export default async function SmsPage({ searchParams }: { searchParams: Promise<{ log?: string }> }) {
  const selectedValue = (await searchParams).log;
  const selectedLog = selectedValue && /^\d+$/.test(selectedValue) ? selectedValue : undefined;
  await requirePage({ perm: "SMS_MANAGE" });
  const [tpls, recentLogs, selectedRows, s] = await Promise.all([db.select().from(smsTemplates).orderBy(smsTemplates.event, smsTemplates.id), db.select().from(smsLogs).orderBy(desc(smsLogs.createdAt)).limit(40), selectedLog ? db.select().from(smsLogs).where(eq(smsLogs.id, Number(selectedLog))).limit(1) : Promise.resolve([]), getSettings()]);
  const logs = [...new Map([...selectedRows, ...recentLogs].map((row) => [row.id, row])).values()].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());
  const keyOk = s.smsProvider === "melipayamak" ? !!(s.smsUsername || process.env.MELIPAYAMAK_USERNAME) && !!(s.smsPassword || process.env.MELIPAYAMAK_PASSWORD) : s.smsProvider === "ippanel" ? !!(s.smsApiKey || process.env.IPPANEL_API_KEY) && !!(s.smsSender || process.env.IPPANEL_SENDER_NUMBER) : !!s.smsApiKey || (s.smsProvider === "kavenegar" ? !!process.env.KAVENEGAR_API_KEY : s.smsProvider === "ghasedak" ? !!process.env.GHASEDAK_API_KEY : s.smsProvider === "mediana" ? !!process.env.MEDIANA_API_KEY : !!process.env.SMSIR_API_KEY);
  const providerName = ({ kavenegar: "کاوه‌نگار", ghasedak: "قاصدک", melipayamak: "ملی‌پیامک", mediana: "مدیانا", ippanel: "IPPanel" } as Record<string, string>)[s.smsProvider] ?? "SMS.ir";
  const events: [string, string, string[]][] = [...Object.entries(SMS_EVENTS).map(([k, v]) => [k, v.title, v.vars] as [string, string, string[]]), ["manual", "ارسال دستی / کمپین", []]];
  const stats = { sent: logs.filter((l) => l.status === "sent" || l.status === "simulated").length, failed: logs.filter((l) => l.status === "failed").length };
  return (
    <>
      <PageHeader title="پنل پیامک پیشرفته" subtitle={`Provider: ${providerName} · کلید API: ${keyOk ? "تنظیم‌شده (مخفی)" : "تنظیم نشده — حالت شبیه‌سازی"} · ${stats.sent.toLocaleString("fa-IR")} موفق / ${stats.failed.toLocaleString("fa-IR")} ناموفق اخیر`}
        actions={<SmsTemplateEditor events={events} provider={s.smsProvider} label="+ الگوی جدید" />} />
      <Card title="تنظیمات اتصال پنل پیامک" className="mb-6">
        <p className="mb-4 text-xs leading-6 text-slate-500">تنظیمات اتصال فقط در این بخش مدیریت می‌شود. رمزها نمایش داده نمی‌شوند؛ برای حفظ رمز قبلی ورودی را خالی بگذارید. شناسه و پارامترهای الگوی تاییدشده هر رویداد را در همان الگو تنظیم کنید. پیش از ذخیره، نوع شناسه، نام پارامترها و ترتیب مقادیر را با مستندات پنل انتخابی تطبیق دهید.</p>
        <JsonForm url="/api/admin/settings" submit="ذخیره تنظیمات پیامک" resetOnDone={false} fields={[
          { name: "smsProvider", label: "سرویس پیامک", type: "select", half: true, defaultValue: s.smsProvider, options: [["kavenegar", "کاوه‌نگار"], ["smsir", "SMS.ir"], ["ghasedak", "قاصدک"], ["melipayamak", "ملی‌پیامک"], ["mediana", "مدیانا"], ["ippanel", "IPPanel"]] },
          { name: "smsSender", label: "شماره خط / Line Number (در IPPanel با قالب +98)", half: true, defaultValue: s.smsSender },
          { name: "smsUsername", label: "نام کاربری ملی‌پیامک", half: true, defaultValue: s.smsUsername, placeholder: "فقط برای ملی‌پیامک" },
          { name: "smsPassword", label: "رمز عبور ملی‌پیامک (خالی = حفظ مقدار قبلی)", type: "password", half: true, defaultValue: "", placeholder: s.smsPassword ? "رمز ثبت شده؛ برای حفظ خالی بگذارید" : "فقط برای ملی‌پیامک" },
          { name: "smsApiKey", label: "کلید API / Access Key (خالی = حفظ مقدار قبلی)", type: "password", half: true, defaultValue: "", placeholder: keyOk ? "کلید API ثبت شده؛ برای حفظ خالی بگذارید" : "کلید API پنل" },
          { name: "smsirParameterMap", label: "نگاشت نام پارامترهای SMS.ir (اختیاری)", type: "textarea", defaultValue: s.smsirParameterMap, placeholder: "code=PARAMETER1,name=PARAMETER2" },
        ]} />
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {events.map(([ev, title, vars]) => {
            const list = tpls.filter((t) => t.event === ev);
            return (
              <Card key={ev} title={<span className="flex flex-wrap items-center gap-2">{title} <Badge>{ev}</Badge><span className="text-xs font-normal text-slate-400">{vars.length ? `متغیرها: ${vars.map((v) => `{${v}}`).join(" ")}` : ""}</span></span>}
                action={<SmsTemplateEditor events={events} provider={s.smsProvider} label="+ الگو برای این رویداد" initial={{ event: ev }} small />}>
                {list.length === 0 ? <p className="text-sm text-slate-400">الگویی برای این رویداد تعریف نشده است.</p> : (
                  <div className="space-y-2">
                    {list.map((t) => (
                      <div key={t.id} className={`rounded-xl border p-3 ${t.isActive ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 opacity-70"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2"><b className="text-sm">{t.title}</b>{t.isActive ? <Badge tone="green">فعال</Badge> : <Badge>غیرفعال</Badge>}{t.isSystem && <Badge tone="blue">سیستمی</Badge>}{t.patternId && <span className="text-xs text-slate-500" dir="ltr">Pattern: {t.patternId}</span>}</div>
                          <div className="flex gap-1">
                            <ActionButton url={`/api/admin/sms-templates/${t.id}`} data={{ isActive: !t.isActive }} className="btn-sm">{t.isActive ? "غیرفعال" : "فعال"}</ActionButton>
                            <SmsTemplateEditor events={events} provider={s.smsProvider} label="ویرایش" initial={{ id: t.id, event: t.event, title: t.title, body: t.body, patternId: t.patternId ?? "", isSystem: t.isSystem, parameterMap: t.parameterMap ?? {} }} small />
                            {!t.isSystem && <ActionButton url={`/api/admin/sms-templates/${t.id}`} data={{ delete: true }} confirm="حذف الگو؟" className="btn-sm">حذف</ActionButton>}
                          </div>
                        </div>
                        {t.patternId && Object.keys(t.parameterMap ?? {}).length > 0 && <p className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">{Object.entries(t.parameterMap).map(([name, providerName]) => <span key={name} className="rounded bg-white px-1.5 py-0.5" dir="ltr">{name} → {providerName}</span>)}</p>}
                        <p className="mt-2 rounded-lg bg-white p-2 text-sm leading-7 text-slate-700">{renderTemplate(t.body, Object.fromEntries(t.variables.map((v) => [v, `«${v}»`])))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <div className="space-y-6">
          <Card title="ارسال پیامک با الگو"><SmsSender templates={tpls.map((t) => ({ id: t.id, title: t.title, event: t.event, body: t.body, variables: t.variables }))} /></Card>
          <Card title="گزارش ارسال">
            <Table head={["رویداد", "گیرنده", "وضعیت", "زمان", ""]}>
              {logs.map((l) => (
                <tr id={`sms-log-${l.id}`} key={l.id} className={selectedLog === String(l.id) ? "bg-amber-50" : ""} title={`${l.body}\n\n${l.response ?? ""}`}>
                  <Td className="text-[11px]">{l.event}</Td><Td className="text-xs"><span dir="ltr">{maskPhone(l.phone)}</span></Td>
                  <Td><StatusBadge status={l.status} /><div className="text-[10px] text-slate-400">{l.attempts.toLocaleString("fa-IR")} تلاش</div></Td><Td className="text-[11px]">{jdate(l.createdAt, true)}</Td>
                  <Td>{l.status === "failed" && <ActionButton url={`/api/admin/sms/logs/${l.id}/retry`} className="btn-sm">ارسال مجدد</ActionButton>}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
