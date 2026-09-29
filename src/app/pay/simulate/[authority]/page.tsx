import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { zpMode } from "@/lib/zarinpal";
import { faNum } from "@/lib/util";

export const metadata = { title: "درگاه آزمایشی" };

/** Only available when ZARINPAL_MERCHANT_ID is not configured. */
export default async function Simulate({ params }: { params: Promise<{ authority: string }> }) {
  if (zpMode() !== "simulator") notFound();
  const { authority } = await params;
  const [p] = await db.select().from(payments).where(and(eq(payments.authority, authority), eq(payments.status, "initiated")));
  if (!p) notFound();
  const cb = `/api/payments/zarinpal/callback?Authority=${encodeURIComponent(authority)}`;
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-amber-50 to-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-amber-400 p-5 text-center text-slate-900"><div className="text-2xl font-black">زرین‌پال</div><div className="text-xs">درگاه پرداخت آزمایشی (Simulator)</div></div>
        <div className="space-y-4 p-6 text-sm">
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">کد پذیرنده زرین‌پال (<code>ZARINPAL_MERCHANT_ID</code>) تنظیم نشده است؛ این صفحه برای آزمایش کامل فرایند خرید است و وجهی کسر نمی‌شود. پس از تنظیم کد پذیرنده، کاربر مستقیماً به درگاه واقعی زرین‌پال هدایت می‌شود.</div>
          <div className="flex justify-between"><span className="text-slate-500">شرح</span><b>{p.details?.number ?? "—"}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">مبلغ</span><b className="text-lg">{faNum(p.amount)} تومان</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Authority</span><code className="text-[10px]" dir="ltr">{authority}</code></div>
          <a href={`${cb}&Status=OK&sim=ok`} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"><ShieldCheck className="h-5 w-5" />پرداخت موفق</a>
          <a href={`${cb}&Status=NOK`} className="block w-full rounded-xl border border-slate-300 py-3 text-center font-bold text-slate-700 hover:bg-slate-50">انصراف از پرداخت</a>
        </div>
      </div>
    </main>
  );
}
