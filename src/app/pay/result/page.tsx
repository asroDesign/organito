import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db";
import { orders, payments, supplyRequests } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { faNum, jdate } from "@/lib/util";

export const metadata = { title: "نتیجه پرداخت" };

export default async function PayResult({ searchParams }: { searchParams: Promise<{ ok?: string; pid?: string; msg?: string }> }) {
  const sp = await searchParams;
  const u = await getUser();
  const pid = Number(sp.pid);
  const [p] = Number.isInteger(pid) && pid > 0 ? await db.select().from(payments).where(eq(payments.id, pid)) : [];
  const mine = p && u && p.recordedBy === u.id ? p : null;
  const ok = mine ? mine.status === "success" : sp.ok === "1";
  const [o] = mine?.orderId ? await db.select().from(orders).where(eq(orders.id, mine.orderId)) : [];
  const [r] = mine?.supplyRequestId ? await db.select().from(supplyRequests).where(eq(supplyRequests.id, mine.supplyRequestId)) : [];
  const back = o ? `/customer/orders/${o.id}` : r ? `/customer/supply/${r.id}` : "/customer";
  return (
    <>
      <SiteHeader />
      {ok && <ClearCartOnSuccess />}
      <main className="mx-auto max-w-lg px-4 py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-center shadow-xl">
          <div className={`p-8 ${ok ? "bg-gradient-to-b from-emerald-50" : "bg-gradient-to-b from-rose-50"}`}>
            {ok ? <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-500" /> : <XCircle className="mx-auto h-20 w-20 text-rose-500" />}
            <h1 className="mt-3 text-2xl font-black">{ok ? "پرداخت موفق" : "پرداخت ناموفق"}</h1>
            <p className="mt-2 text-sm text-slate-600">{(sp.msg ?? "").slice(0, 300)}</p>
          </div>
          {mine && (
            <div className="space-y-2 p-6 text-sm">
              {o && <Row k="شماره سفارش" v={<b dir="ltr">{o.number}</b>} />}
              {r && <Row k="درخواست تأمین" v={<b dir="ltr">{r.number}</b>} />}
              <Row k="مبلغ" v={`${faNum(mine.amount)} تومان`} />
              {mine.refCode && ok && <Row k={`کد رهگیری ${mine.gateway?.startsWith("zibal") ? "زیبال" : "زرین‌پال"}`} v={<b dir="ltr" className="font-mono">{mine.refCode}</b>} />}
              {mine.cardMasked && <Row k="کارت" v={<span dir="ltr">{mine.cardMasked}</span>} />}
              <Row k="زمان" v={jdate(mine.paidAt ?? mine.createdAt, true)} />
            </div>
          )}
          <div className="flex gap-2 border-t p-5">
            <Link href={back} className="btn-primary flex-1">{ok ? "مشاهده سفارش" : "بازگشت و تلاش مجدد"}</Link>
            <Link href="/shop" className="btn-ghost">ادامه خرید</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5"><span className="text-slate-500">{k}</span>{v}</div>;
