"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileArchive, HardDrive, LoaderCircle, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";

type UpdatePackage = { id: string; state: "ready" | "applying" | "applied" | "failed"; version: string; createdAt: string; fileCount: number; migrationCount: number; message?: string; updatedAt: string };
type ReadinessCheck = { key: string; label: string; state: "ready" | "warning" | "blocked"; detail: string };
type Backup = { id: string; version: string; state: string; createdAt: string; databaseBackup: boolean; backupBytes: number };
type ResponseState = { packages: UpdatePackage[]; backups: Backup[]; checks: ReadinessCheck[]; enabled: boolean; currentVersion: string };
const stateText: Record<UpdatePackage["state"], string> = { ready: "آمادهٔ اجرا", applying: "در حال به‌روزرسانی", applied: "تکمیل‌شده", failed: "ناموفق" };
const checkState: Record<ReadinessCheck["state"], { title: string; classes: string }> = {
  ready: { title: "آماده", classes: "bg-emerald-50 text-emerald-700" },
  warning: { title: "نیازمند توجه", classes: "bg-amber-50 text-amber-800" },
  blocked: { title: "مسدود", classes: "bg-rose-50 text-rose-700" },
};
const numberFa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export function AdminUpdateCenter({ superAdmin }: { superAdmin: boolean }) {
  const [data, setData] = useState<ResponseState>({ packages: [], backups: [], checks: [], enabled: false, currentVersion: "…" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/updates", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "دریافت وضعیت به‌روزرسانی ناموفق بود");
    setData(body);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/updates", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "دریافت وضعیت به‌روزرسانی ناموفق بود");
      if (active) setData(body);
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "دریافت وضعیت به‌روزرسانی ناموفق بود"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!data.packages.some((item) => item.state === "applying")) return;
    const timer = window.setInterval(() => { void refresh().catch(() => null); }, 4000);
    return () => window.clearInterval(timer);
  }, [data.packages, refresh]);

  async function upload(event: React.FormEvent) {
    event.preventDefault(); if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/admin/updates", { method: "POST", headers: { "x-csrf": "1" }, body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "اعتبارسنجی بسته ناموفق بود");
      setMessage(`نسخهٔ ${body.package.version} با امضای معتبر دریافت شد و آمادهٔ اجراست.`);
      setFile(null); const input = document.getElementById("update-zip") as HTMLInputElement | null; if (input) input.value = "";
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "بارگذاری بسته ناموفق بود"); }
    finally { setBusy(false); }
  }

  async function apply(item: UpdatePackage) {
    if (!data.enabled || busy || !window.confirm(`نسخهٔ ${item.version} نصب شود؟ پیش از تغییر، پشتیبان دیتابیس و فایل‌های درگیر ساخته می‌شود. در زمان بازراه‌اندازی کوتاه، سایت ممکن است برای چند لحظه در دسترس نباشد.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/updates", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf": "1" }, body: JSON.stringify({ action: "apply", id: item.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "شروع به‌روزرسانی ناموفق بود");
      setMessage("فرایند به‌روزرسانی روی سرور شروع شد؛ این صفحه وضعیت را خودکار به‌روزرسانی می‌کند."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "شروع به‌روزرسانی ناموفق بود"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <section className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-xs text-slate-500">نسخهٔ ثبت‌شده</small><b className="mt-1 block text-lg text-slate-800">{data.currentVersion}</b></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-xs text-slate-500">اجرای امن</small><b className={`mt-1 block text-sm ${data.enabled ? "text-emerald-700" : "text-amber-700"}`}>{data.enabled ? "آماده روی سرور تولید" : "برای این محیط فعال نشده"}</b></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><small className="text-xs text-slate-500">دسترسی</small><b className="mt-1 block text-sm text-slate-800">فقط مدیر کل · بستهٔ امضاشده</b></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><ShieldCheck className="size-5"/></span><div><h2 className="font-extrabold text-slate-800">آمادگی سرور برای به‌روزرسانی</h2><p className="mt-1 text-xs leading-6 text-slate-500">این بررسی فقط وضعیت را می‌خواند و هیچ تنظیم یا داده‌ای را تغییر نمی‌دهد. جزئیات محرمانهٔ سرور نمایش داده نمی‌شود.</p></div></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{data.checks.map((check) => <div key={check.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-slate-800">{check.label}</b><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${checkState[check.state].classes}`}>{checkState[check.state].title}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{check.detail}</p></div>)}</div>
      {data.checks.some((check) => check.state === "blocked") && <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-6 text-rose-800">تا برطرف‌شدن موارد مسدود، دکمهٔ اجرا فعال نمی‌شود. برای اصلاح ابزارهای سرور یا متغیرهای محیطی از پشتیبان فنی کمک بگیرید.</p>}
    </section>

    {!data.enabled && <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-0.5 size-5 shrink-0"/><p className="text-sm leading-7">به‌روزرسانی فقط روی سرور خودمیزبان production با کلید عمومی ناشر، ابزار پشتیبان‌گیری دیتابیس و PM2 فعال می‌شود. این محیط یا تنظیمات سرور هنوز اجرای آپدیت را فعال نکرده است؛ بستهٔ امضاشده پس از تنظیم کلید قابل بررسی و اجرا خواهد بود.</p></div>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

    <form onSubmit={upload} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UploadCloud className="size-5"/></span><div><h2 className="font-extrabold text-slate-800">بارگذاری بستهٔ به‌روزرسانی</h2><p className="mt-1 text-xs leading-6 text-slate-500">فایل ZIP امضاشده را انتخاب کنید. سامانه پیش از ذخیره، ناشر، نسخه، فهرست فایل‌ها و سلامت هر فایل را بررسی می‌کند.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label htmlFor="update-zip" className="block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 hover:border-emerald-400"><span className="flex items-center gap-2"><FileArchive className="size-4 text-emerald-700"/>{file ? file.name : "انتخاب فایل ZIP (حداکثر ۱۲۰ مگابایت)"}</span><input id="update-zip" type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)}/></label>
        <button disabled={!file || busy || !superAdmin} className="btn-primary min-w-36 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin"/> : <ShieldCheck className="size-4"/>}{busy ? "در حال بررسی…" : "اعتبارسنجی بسته"}</button>
      </div>
    </form>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-slate-800">بسته‌های دریافت‌شده</h2><p className="mt-1 text-xs text-slate-500">بستهٔ معتبر پس از تأیید مدیر کل، بدون ورود به سرور اجرا می‌شود.</p></div><button type="button" className="btn-ghost" onClick={() => void refresh().catch((e) => setError(e.message))}><RefreshCw className="size-4"/>به‌روزرسانی فهرست</button></div>
      <div className="space-y-3">{data.packages.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><b className="text-slate-800">نسخهٔ {item.version}</b><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.state === "applied" ? "bg-emerald-50 text-emerald-700" : item.state === "failed" ? "bg-rose-50 text-rose-700" : item.state === "applying" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{stateText[item.state]}</span></div><p className="mt-2 text-xs leading-6 text-slate-500">{item.fileCount} فایل · {item.migrationCount} migration افزایشی · دریافت {new Date(item.createdAt).toLocaleString("fa-IR")}</p>{item.message && <p className="mt-2 text-xs leading-6 text-slate-600">{item.message}</p>}</div>
          {item.state === "ready" && <button type="button" disabled={!data.enabled || busy || !superAdmin} onClick={() => void apply(item)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin"/> : <CheckCircle2 className="size-4"/>}اجرای به‌روزرسانی</button>}
          {item.state === "applying" && <span className="flex items-center gap-2 text-xs font-bold text-amber-700"><Clock3 className="size-4 animate-pulse"/>در حال اجرا</span>}
        </div>
      </article>)}{!data.packages.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">هنوز بسته‌ای بارگذاری نشده است.</p>}</div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><HardDrive className="size-5"/></span><div><h2 className="font-extrabold text-slate-800">پشتیبان‌های ساخته‌شده</h2><p className="mt-1 text-xs leading-6 text-slate-500">پشتیبان پایگاه داده پیش از هر تغییر کد ساخته و در فضای خصوصی سرور نگهداری می‌شود؛ محتوای آن از پنل دریافت نمی‌شود.</p></div></div>
      <div className="space-y-2">{data.backups.map((backup) => <div key={backup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><b className="text-sm text-slate-800">نسخهٔ {backup.version}</b><p className="mt-1 text-[11px] text-slate-500">{new Date(backup.createdAt).toLocaleString("fa-IR")} · {backup.databaseBackup ? `پشتیبان دیتابیس ${numberFa(Math.max(1, Math.round(backup.backupBytes / 1_048_576)))} مگابایت` : "پشتیبان دیتابیس ناقص یا موجود نیست"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${backup.databaseBackup ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{backup.databaseBackup ? "موجود" : "نیازمند بررسی"}</span></div>)}{!data.backups.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">هنوز پشتیبانی از طریق به‌روزرسانی پنل ایجاد نشده است.</p>}</div>
    </section>
    <p className="text-[11px] leading-6 text-slate-400">این فهرست سلامت و وجود فایل پشتیبان را نشان می‌دهد؛ بازیابی دیتابیس از پنل انجام نمی‌شود تا اطلاعات عملیاتی به‌اشتباه بازنویسی نشوند. migrationهای مخرب یا بازنویسنده پذیرفته نمی‌شوند.</p>
  </div>;
}
