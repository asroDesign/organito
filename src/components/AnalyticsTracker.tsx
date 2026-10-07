"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Cookie, ShieldCheck, X } from "lucide-react";
import { analyticsConsent, analyticsPageKey, setAnalyticsConsent, trackAnalyticsEvent } from "@/lib/analytics-client";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = analyticsConsent();
    setChoice(saved);
    setOpen(!saved);
  }, []);

  useEffect(() => {
    if (choice === "accepted" && analyticsPageKey(pathname)) trackAnalyticsEvent("page_view", undefined, pathname);
  }, [choice, pathname]);

  const save = (value: "accepted" | "rejected") => {
    setAnalyticsConsent(value);
    setChoice(value);
    setOpen(false);
  };

  if (!analyticsPageKey(pathname)) return null;

  return <>
    <button type="button" aria-label="تنظیم حریم خصوصی و آمار بازدید" onClick={() => setOpen((value) => !value)} className="fixed bottom-4 left-4 z-[75] grid size-10 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-lg backdrop-blur transition hover:text-emerald-700"><ShieldCheck className="size-5"/></button>
    {open && <section role="dialog" aria-label="تنظیم رضایت آمار بازدید" className="fixed bottom-[4.5rem] left-4 z-[75] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-emerald-100 bg-white p-4 text-right shadow-2xl" dir="rtl">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BarChart3 className="size-5"/></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><b className="text-sm text-slate-900">آمار ناشناس استفاده از فروشگاه</b><button type="button" aria-label="بستن" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={() => setOpen(false)}><X className="size-4"/></button></div><p className="mt-1 text-xs leading-6 text-slate-600">با اجازه شما، مسیر بازدید محصول تا خرید برای بهبود فروشگاه به‌صورت ناشناس ثبت می‌شود. IP، نام و شماره همراه ذخیره نمی‌شود و رویدادها پس از ۹۰ روز پاک می‌شوند.</p></div></div>
      <div className="mt-3 flex gap-2"><button type="button" className="btn-primary flex-1" onClick={() => save("accepted")}><Cookie className="size-4"/>اجازه می‌دهم</button><button type="button" className="btn-ghost flex-1" onClick={() => save("rejected")}>رد آمارگیری</button></div>
      {choice && <p className="mt-2 text-center text-[10px] text-slate-400">وضعیت فعلی: {choice === "accepted" ? "اجازه داده شده" : "رد شده"}</p>}
    </section>}
  </>;
}
