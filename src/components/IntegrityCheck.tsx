"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type R = { pass: boolean; debit: string; credit: string; unbalanced_entries: string; bad_offers: string; bad_products: string; bad_wallets: string; audit_count: string };
export function IntegrityCheck() {
  const [r, setR] = useState<R | null>(null);
  useEffect(() => { fetch("/api/admin/integrity").then((x) => x.json()).then(setR).catch(() => null); }, []);
  if (!r) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  const f = (n: string) => Number(n).toLocaleString("fa-IR");
  return (
    <div className="space-y-2 text-sm">
      <div className={`flex items-center gap-2 rounded-xl p-3 font-bold ${r.pass ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{r.pass ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{r.pass ? "همه کنترل‌ها موفق" : "ناسازگاری یافت شد"}</div>
      <div className="flex justify-between"><span>جمع بدهکار</span><b>{f(r.debit)}</b></div>
      <div className="flex justify-between"><span>جمع بستانکار</span><b>{f(r.credit)}</b></div>
      <div className="flex justify-between"><span>اسناد نامتوازن</span><b>{f(r.unbalanced_entries)}</b></div>
      <div className="flex justify-between"><span>رزرو نامعتبر (فروشنده/مرکزی)</span><b>{f(r.bad_offers)} / {f(r.bad_products)}</b></div>
      <div className="flex justify-between"><span>کیف پول منفی</span><b>{f(r.bad_wallets)}</b></div>
      <div className="flex justify-between"><span>رویدادهای ممیزی</span><b>{f(r.audit_count)}</b></div>
    </div>
  );
}
