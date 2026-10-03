"use client";
import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { api } from "./client";
import { Modal } from "./Modal";
import { jdate, faNum } from "@/lib/util";

type ViewLog = { id: number; ip: string; userAgent: string | null; viewedAt: string };
type ViewResult = { total: number; logs: ViewLog[] };

export function ProductViewLogButton({ productId, productName }: { productId: number; productName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ViewResult | null>(null);
  const [error, setError] = useState("");

  const show = async () => {
    setOpen(true);
    setBusy(true);
    setError("");
    try { setData(await api<ViewResult>(`/api/admin/products/${productId}/views`, "GET")); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return <>
    <button type="button" className="btn-sm" onClick={show}><Eye className="size-3.5"/>بازدیدها</button>
    {open && <Modal title={`لاگ بازدید محصول: ${productName}`} onClose={() => setOpen(false)} wide>
      {busy ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="size-5 animate-spin"/>در حال دریافت لاگ‌ها…</div>
        : error ? <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        : <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><b className="text-lg">{faNum(data?.total ?? 0)} بازدید ثبت‌شده</b><p className="mt-1 text-xs text-slate-500">IP فقط در پنل مدیریت نمایش داده می‌شود.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{faNum(data?.logs.length ?? 0)} مورد اخیر</span></div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">ردیف</th><th className="p-3">IP کاربر</th><th className="p-3">زمان بازدید</th><th className="p-3">مرورگر / دستگاه</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.logs.map((log, index) => <tr key={log.id}><td className="p-3 text-slate-400">{faNum(data.total - index)}</td><td className="p-3 font-mono" dir="ltr">{log.ip}</td><td className="p-3">{jdate(log.viewedAt, true)}</td><td className="max-w-[280px] truncate p-3 text-xs text-slate-500" dir="ltr" title={log.userAgent ?? ""}>{log.userAgent || "نامشخص"}</td></tr>)}</tbody></table>
            {!data?.logs.length && <p className="p-10 text-center text-sm text-slate-500">برای این محصول هنوز بازدیدی ثبت نشده است.</p>}
          </div>{(data?.total ?? 0) > (data?.logs.length ?? 0) && <p className="mt-2 text-xs text-slate-500">فقط ۲۵۰ بازدید اخیر در این پنجره نمایش داده می‌شود.</p>}
        </>}
    </Modal>}
  </>;
}
