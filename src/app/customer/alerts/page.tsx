import { BellRing } from "lucide-react";
import { getUser } from "@/lib/auth";
import { CustomerAlertManager } from "@/components/CustomerAlertManager";

export default async function CustomerAlertsPage({ searchParams }: { searchParams: Promise<{ unsubscribe?: string }> }) {
  const [user, query] = await Promise.all([getUser(), searchParams]);
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8"><header className="rounded-3xl bg-gradient-to-l from-emerald-950 via-emerald-900 to-emerald-700 p-6 text-white"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-white/10"><BellRing className="size-6 text-lime-300"/></span><div><p className="text-xs text-emerald-100/70">حساب کاربری</p><h1 className="text-2xl font-black">اعلان‌های محصولات</h1></div></div><p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/80">اشتراک موجودشدن یا کاهش قیمت را مدیریت کنید و نتیجهٔ ارسال پیامک‌ها را ببینید.</p></header><CustomerAlertManager signedIn={!!user} token={query.unsubscribe}/></main>;
}
