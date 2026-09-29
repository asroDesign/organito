import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supplyQuotes, supplyRequests } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { JsonForm } from "@/components/client";
import { SUPPLY_STATUS, faNum, jdate, toman } from "@/lib/util";

export default async function SellerRfq() {
  const u = await requirePage({ role: "seller" });
  const list = await db.select({ q: supplyQuotes, r: supplyRequests }).from(supplyQuotes).innerJoin(supplyRequests, eq(supplyRequests.id, supplyQuotes.requestId)).where(eq(supplyQuotes.sellerId, u.sellerId!)).orderBy(desc(supplyQuotes.createdAt));
  return (
    <>
      <PageHeader title="درخواست‌های استعلام قیمت (RFQ)" subtitle="قیمت، موجودی و زمان تأمین خود را اعلام کنید" />
      {list.length === 0 ? <Empty title="RFQ فعالی ندارید" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map(({ q, r }) => (
            <Card key={q.id} title={<span className="flex items-center gap-2">{r.number} <StatusBadge status={q.status} map={{ requested: "منتظر پاسخ", quoted: "پاسخ داده‌شده", selected: "برنده", rejected: "انتخاب نشد" }} /></span>} action={<span className="text-xs text-slate-400">{jdate(q.createdAt)}</span>}>
              <div className="mb-3 text-sm"><b>{r.partName || "محصول"}</b> <span dir="ltr" className="text-slate-500">{r.partNumber}</span><div className="text-xs text-slate-500">{r.carMake} {r.carModel} {r.carYear} · تعداد {faNum(r.qty)} · {SUPPLY_STATUS[r.status]}</div>{r.vin && <div className="text-xs" dir="ltr">VIN: {r.vin}</div>}</div>
              {q.status === "quoted" && <div className="mb-2 rounded-lg bg-emerald-50 p-2 text-xs">پاسخ شما: {toman(q.price)} · موجودی {faNum(q.stock)} · {faNum(q.leadDays)} روز</div>}
              {["requested", "quoted"].includes(q.status) && ["rfq_sent", "supplier_found"].includes(r.status) && (
                <JsonForm url={`/api/seller/rfq/${q.id}`} submit={q.status === "quoted" ? "به‌روزرسانی پاسخ" : "ارسال پیشنهاد"} fields={[
                  { name: "price", label: "قیمت واحد", type: "number", required: true, half: true, defaultValue: q.price || "" },
                  { name: "stock", label: "موجودی", type: "number", half: true, defaultValue: q.stock },
                  { name: "leadDays", label: "Lead Time (روز)", type: "number", half: true, defaultValue: q.leadDays },
                  { name: "brand", label: "برند", half: true, defaultValue: q.brand ?? "" },
                  { name: "note", label: "توضیح", defaultValue: q.note ?? "" },
                ]} />
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
