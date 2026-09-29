import Link from "next/link";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "تماس با ما" };

export default async function Contact() {
  const s = await getSettings();
  const rows = [[MapPin, "نشانی", s.senderAddress], [Phone, "تلفن", "021-91000000"], [Mail, "ایمیل", "info@sabzineh.ir"], [Clock, "ساعات پاسخگویی", "شنبه تا پنجشنبه ۹ تا ۱۸"]] as const;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-2">
        <div className="space-y-4"><h1 className="text-2xl font-black">تماس با ما</h1>{rows.map(([I, t, v]) => <div key={t} className="flex items-center gap-3 rounded-2xl border bg-white p-4"><I className="h-6 w-6 text-emerald-600" /><div><div className="text-xs text-slate-500">{t}</div><b>{v}</b></div></div>)}</div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 text-white"><b className="text-xl">پشتیبانی آنلاین</b><p className="mt-3 leading-8 text-emerald-100">برای پیگیری سفارش، مشاوره تغذیه یا امور مالی، تیکت ثبت کنید و دپارتمان مربوط را انتخاب کنید. پاسخ کارشناسان از طریق پیامک اطلاع‌رسانی می‌شود.</p><Link href="/customer/tickets" className="mt-6 inline-block rounded-xl bg-white px-5 py-2.5 font-bold text-emerald-800">ثبت تیکت</Link></div>
      </main>
      <SiteFooter />
    </>
  );
}
