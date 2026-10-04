import { asc } from "drizzle-orm";
import { db } from "@/db";
import { carrierRates, carriers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionButton, JsonForm } from "@/components/client";
import { CarrierEditor } from "@/components/CarrierEditor";
import { faNum, toman } from "@/lib/util";

export default async function CarriersPage() {
  await requirePage({ perm: "SHIPMENTS_MANAGE" });
  const [cs, rates] = await Promise.all([db.select().from(carriers).orderBy(asc(carriers.sortOrder), asc(carriers.id)), db.select().from(carrierRates).orderBy(asc(carrierRates.city), asc(carrierRates.minWeight))]);
  return (
    <>
      <PageHeader title="شرکت‌های پستی و تعرفه ارسال" subtitle="ارسال با هزینه طبق شهر و وزن محاسبه می‌شود؛ پس‌کرایه برای هر شرکت یک گزینه مستقل از شهر و وزن است." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {cs.map((c) => {
            const rs = rates.filter((r) => r.carrierId === c.id);
            return (
              <Card key={c.id} title={<span className="flex items-center gap-2">{c.name} <code className="text-xs text-slate-400">{c.code}</code>{c.isActive ? <Badge tone="green">فعال</Badge> : <Badge>غیرفعال</Badge>}</span>}
                action={<div className="flex gap-1"><CarrierEditor c={{ id: c.id, name: c.name, trackingUrl: c.trackingUrl ?? "", baseCost: c.baseCost, perKgCost: c.perKgCost, freeThreshold: c.freeThreshold, minDays: c.minDays, maxDays: c.maxDays, sortOrder: c.sortOrder, supportsFreightCollect: c.supportsFreightCollect }} /><ActionButton url={`/api/admin/carriers/${c.id}`} data={{ isActive: !c.isActive }} className="btn-sm">{c.isActive ? "غیرفعال" : "فعال"}</ActionButton></div>}>
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2">پایه (تا ۱ کیلو): <b>{toman(c.baseCost)}</b></div>
                  <div className="rounded-lg bg-slate-50 p-2">هر کیلو اضافه: <b>{toman(c.perKgCost)}</b></div>
                  <div className="rounded-lg bg-slate-50 p-2">ارسال رایگان از: <b>{c.freeThreshold ? toman(c.freeThreshold) : "—"}</b></div>
                  <div className="rounded-lg bg-slate-50 p-2">زمان تحویل: <b>{faNum(c.minDays)} تا {faNum(c.maxDays)} روز</b></div>
                  <div className="rounded-lg bg-amber-50 p-2">پس‌کرایه: <b>{c.supportsFreightCollect ? "فعال" : "غیرفعال"}</b></div>
                </div>
                {c.trackingUrl && <div className="mb-3 truncate text-xs text-slate-500" dir="ltr">Tracking: {c.trackingUrl}</div>}
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500"><tr><th className="p-1.5 text-right">شهر</th><th className="p-1.5 text-right">وزن (گرم)</th><th className="p-1.5 text-right">هزینه</th><th /></tr></thead>
                  <tbody className="divide-y">
                    {rs.map((r) => <tr key={r.id}><td className="p-1.5">{r.city ?? <span className="text-slate-400">همه شهرها</span>}</td><td className="p-1.5">{faNum(r.minWeight)} – {faNum(r.maxWeight)}</td><td className="p-1.5 font-bold">{toman(r.cost)}</td><td className="p-1.5"><ActionButton url={`/api/admin/carrier-rates/${r.id}/delete`} confirm="حذف تعرفه؟" className="btn-sm">حذف</ActionButton></td></tr>)}
                    {!rs.length && <tr><td colSpan={4} className="p-2 text-xs text-slate-400">تعرفه‌ای تعریف نشده؛ فرمول پایه اعمال می‌شود.</td></tr>}
                  </tbody>
                </table>
                <div className="mt-3 rounded-xl border border-dashed p-3">
                  <JsonForm url={`/api/admin/carriers/${c.id}/rates`} submit="افزودن تعرفه" fields={[
                    { name: "city", label: "شهر (خالی = همه)", half: true }, { name: "cost", label: "هزینه (تومان)", type: "number", required: true, half: true },
                    { name: "minWeight", label: "از وزن (گرم)", type: "number", half: true, defaultValue: 0 }, { name: "maxWeight", label: "تا وزن (گرم)", type: "number", half: true, defaultValue: 5000 },
                  ]} />
                </div>
              </Card>
            );
          })}
        </div>
        <Card title="افزودن شرکت پستی">
          <JsonForm url="/api/admin/carriers" submit="ایجاد" fields={[
            { name: "name", label: "نام شرکت", required: true }, { name: "code", label: "کد انگلیسی", half: true }, { name: "sortOrder", label: "ترتیب", type: "number", half: true, defaultValue: 10 },
            { name: "trackingUrl", label: "آدرس رهگیری (https، با {code})", placeholder: "https://tracking.post.ir/?id={code}" },
            { name: "supportsFreightCollect", label: "امکان ارسال پس‌کرایه", type: "checkbox" },
            { name: "baseCost", label: "هزینه پایه", type: "number", half: true }, { name: "perKgCost", label: "هر کیلو اضافه", type: "number", half: true },
            { name: "freeThreshold", label: "ارسال رایگان از مبلغ", type: "number", half: true }, { name: "minDays", label: "حداقل روز", type: "number", half: true, defaultValue: 1 },
            { name: "maxDays", label: "حداکثر روز", type: "number", half: true, defaultValue: 3 },
          ]} />
        </Card>
      </div>
    </>
  );
}
