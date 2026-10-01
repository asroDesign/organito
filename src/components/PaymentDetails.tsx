import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, type payments } from "@/db/schema";
import { PAY_METHOD, PAY_STATUS } from "@/lib/printAccess";
import { currencyUnit, faNum, jdate } from "@/lib/util";
import { ActionButton } from "./client";
import { StatusBadge } from "./ui";

type P = typeof payments.$inferSelect;

/** Full payment details for staff (gateway info, manual receipts, audit fields). */
export async function PaymentDetails({ pays, orderId, canManage }: { pays: P[]; orderId: number; canManage: boolean }) {
  const ids = pays.flatMap((p) => [p.recordedBy, p.verifiedBy]).filter(Boolean) as number[];
  const people = ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : [];
  const nm = (id: number | null) => people.find((x) => x.id === id)?.name ?? "—";
  if (!pays.length) return <p className="text-sm text-slate-500">هنوز پرداختی برای این سفارش ثبت نشده است.</p>;
  return (
    <div className="space-y-3">
      {pays.map((p) => (
        <div key={p.id} className={`rounded-xl border p-3 text-xs ${p.status === "pending_verification" ? "border-amber-300 bg-amber-50" : p.status === "success" ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50"}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{PAY_METHOD[p.method] ?? p.method} — {faNum(p.amount)} {currencyUnit()}</b><StatusBadge status={p.status === "success" ? "paid" : p.status === "pending_verification" ? "pending" : p.status} map={{ paid: PAY_STATUS.success, pending: PAY_STATUS.pending_verification, rejected: PAY_STATUS.rejected, refunded: PAY_STATUS.refunded }} /></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ["شناسه پرداخت", `#${p.id}`], ["شماره مرجع", p.refCode], ["درگاه", p.gateway], ["Authority", p.authority], ["کارت", p.cardMasked], ["شماره پیگیری", p.trackingCode],
              ["واریزکننده", p.payerName], ["بانک", p.bankName], ["زمان پرداخت", jdate(p.paidAt ?? p.createdAt, true)], ["ثبت در سیستم", jdate(p.createdAt, true)],
              ["ثبت‌کننده", nm(p.recordedBy)], ["تأییدکننده", p.verifiedBy ? `${nm(p.verifiedBy)} (${jdate(p.verifiedAt, true)})` : null], ["IP", p.ip], ["کلید یکتا", p.idempotencyKey],
              ...Object.entries(p.details ?? {}),
            ].filter(([, v]) => v).map(([k, v]) => <div key={k as string} className="flex justify-between gap-2 border-b border-dashed border-slate-200 py-0.5"><span className="text-slate-500">{k}</span><b dir="auto" className="truncate">{v}</b></div>)}
          </div>
          {p.userAgent && <div className="mt-1 truncate text-[10px] text-slate-400" dir="ltr" title={p.userAgent}>{p.userAgent}</div>}
          {p.note && <div className="mt-1">توضیح: {p.note}</div>}
          {p.receiptMediaId && <a href={`/api/media/${p.receiptMediaId}`} target="_blank" className="mt-2 inline-block">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${p.receiptMediaId}`} alt="فیش" className="h-24 rounded-lg border" /></a>}
          {canManage && p.status === "pending_verification" && (
            <div className="mt-3 flex gap-2">
              <ActionButton url={`/api/admin/orders/${orderId}/payment`} data={{ action: "verify", paymentId: p.id }} confirm="پرداخت تأیید و سفارش پرداخت‌شده شود؟" className="btn-success">تأیید پرداخت</ActionButton>
              <ActionButton url={`/api/admin/orders/${orderId}/payment`} data={{ action: "reject", paymentId: p.id }} prompt="دلیل رد فیش:" promptKey="reason" className="btn-danger">رد فیش</ActionButton>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
