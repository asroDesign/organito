import type { payments } from "@/db/schema";
import { PAY_METHOD, PAY_STATUS } from "@/lib/printAccess";
import { currencyUnit, faNum, jdate } from "@/lib/util";

type P = typeof payments.$inferSelect;

/** Printable payment block for invoices (successful and pending payments). */
export function PaymentInfoBox({ pays, compact }: { pays: P[]; compact?: boolean }) {
  const list = pays.filter((p) => p.status !== "rejected");
  if (!list.length) return <div className="rounded-lg border border-slate-400 p-2 text-xs">وضعیت پرداخت: پرداخت نشده</div>;
  return (
    <div className="rounded-lg border border-slate-400 p-3 text-xs">
      <b className="mb-1 block border-b border-slate-300 pb-1">اطلاعات پرداخت</b>
      {list.map((p) => (
        <div key={p.id} className={`grid gap-x-4 gap-y-0.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"} py-1`}>
          <div>روش: <b>{PAY_METHOD[p.method] ?? p.method}</b></div>
          <div>وضعیت: <b>{PAY_STATUS[p.status] ?? p.status}</b></div>
          <div>مبلغ: <b>{faNum(p.amount)} {currencyUnit()}</b></div>
          <div>تاریخ: <b>{jdate(p.paidAt ?? p.createdAt, true)}</b></div>
          {p.gateway && <div>درگاه: <b>{p.gateway}</b></div>}
          {p.refCode && <div>شماره مرجع: <b dir="ltr">{p.refCode}</b></div>}
          {p.trackingCode && <div>شماره پیگیری: <b dir="ltr">{p.trackingCode}</b></div>}
          {p.cardMasked && <div>کارت: <b dir="ltr">{p.cardMasked}</b></div>}
          {p.payerName && <div>واریزکننده: <b>{p.payerName}</b></div>}
          {p.bankName && <div>بانک: <b>{p.bankName}</b></div>}
          {p.note && <div className="col-span-full">توضیح: {p.note}</div>}
        </div>
      ))}
    </div>
  );
}
