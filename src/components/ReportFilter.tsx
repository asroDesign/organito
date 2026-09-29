"use client";
import Link from "next/link";
import { JalaliDatePicker } from "./JalaliDatePicker";

export function ReportFilter({ tab, from, to, extra }: { tab: string; from?: string; to?: string; extra?: Record<string, string | undefined> }) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <input type="hidden" name="tab" value={tab} />
      {Object.entries(extra ?? {}).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <label className="w-44 text-xs text-slate-500">از تاریخ<JalaliDatePicker name="from" defaultValue={from ?? ""} allowEmpty placeholder="ابتدای دوره" /></label>
      <label className="w-44 text-xs text-slate-500">تا تاریخ<JalaliDatePicker name="to" defaultValue={to ?? ""} allowEmpty placeholder="امروز" /></label>
      <button className="btn-primary">اعمال بازه</button>
      <Link href={`?tab=${tab}`} className="btn-ghost">همه دوره‌ها</Link>
      <button type="button" onClick={() => window.print()} className="btn-ghost">چاپ گزارش</button>
    </form>
  );
}
