"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Laptop, Loader2, MapPin, MonitorSmartphone, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { api, toast } from "@/components/client";
import { Card, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";

type LoginSession = { id: string; device: string; ip: string; createdAt: string; expiresAt: string; current: boolean };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));
}

function SessionIcon({ device }: { device: string }) {
  return /android|iphone|ipad/i.test(device) ? <Smartphone className="size-5"/> : <Laptop className="size-5"/>;
}

export function SessionManager() {
  const [rows, setRows] = useState<LoginSession[]>([]);
  const [selected, setSelected] = useState<LoginSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows(await api<LoginSession[]>("/api/customer/sessions", "GET")); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const revoke = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/api/customer/sessions/${encodeURIComponent(selected.id)}`, "DELETE");
      setRows((current) => current.filter((row) => row.id !== selected.id));
      setSelected(null); toast("نشست انتخاب‌شده پایان یافت");
    } catch (e) { toast((e as Error).message, false); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <PageHeader title="نشست‌های فعال و امنیت حساب" subtitle="دستگاه‌هایی که با حساب شما وارد شده‌اند را بررسی و در صورت نیاز خارج کنید" actions={<button type="button" className="btn-ghost" onClick={() => void refresh()}><MonitorSmartphone className="size-4"/>تازه‌سازی</button>}/>
    <Card className="border-sky-200 bg-sky-50/70"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sky-700"><ShieldCheck className="size-5"/></span><div><b className="text-sm text-sky-950">از اینجا می‌توانید دسترسی دستگاه‌های دیگر را ببندید</b><p className="mt-1 text-xs leading-6 text-sky-900/75">نشست جاری با برچسب «این دستگاه» مشخص شده است. آدرس شبکه به‌صورت ناقص نمایش داده می‌شود و مکان جغرافیایی دقیق ثبت یا نمایش داده نمی‌شود. نشست‌ها حداکثر پس از ۷ روز منقضی می‌شوند.</p></div></div></Card>
    {error && <Card className="border-rose-200 bg-rose-50"><div className="flex items-center justify-between gap-3 text-sm text-rose-800"><span>{error}</span><button className="btn-sm" onClick={() => void refresh()}>تلاش دوباره</button></div></Card>}
    {loading ? <Card><div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="size-5 animate-spin"/>در حال دریافت نشست‌ها…</div></Card>
      : rows.length ? <div className="grid gap-3 lg:grid-cols-2">{rows.map((row) => <Card key={row.id} className={row.current ? "border-emerald-300 ring-1 ring-emerald-100" : ""}>
        <div className="flex items-start gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${row.current ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><SessionIcon device={row.device}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{row.device}</b>{row.current && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">این دستگاه</span>}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><MapPin className="size-3.5"/>IP تقریبی: <b dir="ltr">{row.ip}</b></span><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5"/>ورود: {dateLabel(row.createdAt)}</span></div><div className="mt-1 text-[11px] text-slate-400">انقضا: {dateLabel(row.expiresAt)}</div></div></div>
        {!row.current && <button type="button" className="btn-ghost mt-4 w-full justify-center border-t border-slate-100 pt-3 text-rose-700 hover:bg-rose-50" onClick={() => setSelected(row)}><Trash2 className="size-4"/>پایان‌دادن به این نشست</button>}
      </Card>)}</div> : !error && <Card><div className="py-10 text-center text-sm text-slate-500">نشست فعالی پیدا نشد. برای ورود دوباره، صفحه را تازه‌سازی کنید.</div></Card>}
    {selected && <Modal title="پایان نشست این دستگاه؟" onClose={() => !busy && setSelected(null)}><div className="space-y-4"><p className="text-sm leading-7 text-slate-600">دسترسی <b>{selected.device}</b> از حساب شما قطع می‌شود و آن دستگاه باید دوباره وارد حساب شود.</p><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-ghost" disabled={busy} onClick={() => setSelected(null)}>انصراف</button><button className="btn-primary bg-rose-600 hover:bg-rose-700" disabled={busy} onClick={() => void revoke()}>{busy && <Loader2 className="size-4 animate-spin"/>}پایان نشست</button></div></div></Modal>}
  </div>;
}
