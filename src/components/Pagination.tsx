"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const SIZES = [10, 25, 50, 100];
export function Pagination({ page, pageSize, total, onChange, pageKey = "page", pageSizeKey = "pageSize" }: { page: number; pageSize: number; total: number; onChange?: (page: number, pageSize: number) => void; pageKey?: string; pageSizeKey?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const change = (nextPage: number, nextSize = pageSize) => {
    const p = Math.max(1, Math.min(pages, nextPage));
    if (onChange) return onChange(p, nextSize);
    const url = new URL(window.location.href);
    url.searchParams.set(pageKey, String(p));
    url.searchParams.set(pageSizeKey, String(nextSize));
    window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
  };
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);
  const numbers = new Set<number>([1, pages, page - 1, page, page + 1]);
  const visible = [...numbers].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return <nav aria-label="صفحه‌بندی نتایج" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap items-center gap-3 text-slate-500"><span>نمایش <b className="text-slate-800">{start.toLocaleString("fa-IR")} تا {end.toLocaleString("fa-IR")}</b> از <b className="text-slate-800">{total.toLocaleString("fa-IR")}</b></span><label className="flex items-center gap-2">تعداد در صفحه<select className="input !h-9 !w-20 !py-1" value={pageSize} onChange={(e) => change(1, Number(e.target.value))}>{SIZES.map((n) => <option key={n} value={n}>{n.toLocaleString("fa-IR")}</option>)}</select></label></div>
    <div className="flex items-center justify-center gap-1" dir="ltr">
      <button aria-label="صفحه اول" title="صفحه اول" className="btn-sm !px-2" disabled={page <= 1} onClick={() => change(1)}><ChevronsLeft className="size-4" /></button>
      <button aria-label="صفحه قبل" title="صفحه قبل" className="btn-sm !px-2" disabled={page <= 1} onClick={() => change(page - 1)}><ChevronLeft className="size-4" /></button>
      {visible.map((n, i) => <span key={n} className="contents">{i > 0 && n - visible[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}<button onClick={() => change(n)} aria-current={n === page ? "page" : undefined} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold ${n === page ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{n.toLocaleString("fa-IR")}</button></span>)}
      <button aria-label="صفحه بعد" title="صفحه بعد" className="btn-sm !px-2" disabled={page >= pages} onClick={() => change(page + 1)}><ChevronRight className="size-4" /></button>
      <button aria-label="صفحه آخر" title="صفحه آخر" className="btn-sm !px-2" disabled={page >= pages} onClick={() => change(pages)}><ChevronsRight className="size-4" /></button>
    </div>
  </nav>;
}
