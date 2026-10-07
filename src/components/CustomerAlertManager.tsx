"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, ExternalLink, LoaderCircle, MessageSquareText } from "lucide-react";
import { api, toast } from "./client";
import { faNum, jdate } from "@/lib/util";

type Subscription = { id: number; productName: string | null; slug: string | null; variantId: number; variantTitle: string | null; phone: string; alertRestock: boolean; alertPriceDrop: boolean; active: boolean; createdAt: string };
type Delivery = { subscriptionId: number; status: string; createdAt: string | Date; productName: string };
const statusText: Record<string, string> = { sent: "ارسال‌شده", simulated: "شبیه‌سازی پنل", failed: "ناموفق", pending: "در انتظار" };
export function CustomerAlertManager({ signedIn, token }: { signedIn: boolean; token?: string }) {
  const [rows, setRows] = useState<Subscription[]>([]), [deliveries, setDeliveries] = useState<Delivery[]>([]), [busy, setBusy] = useState(signedIn), [done, setDone] = useState(false);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void fetch("/api/product-alerts/mine", { cache: "no-store" }).then(async (r) => {
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "دریافت اعلان‌ها انجام نشد"); return d;
    }).then((d) => { if (!cancelled) { setRows(d.subscriptions); setDeliveries(d.deliveries); } })
      .catch((e) => { if (!cancelled) toast(e instanceof Error ? e.message : "خطا در دریافت اعلان‌ها", false); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [signedIn]);
  const cancel = async (id: number) => { try { await api(`/api/product-alerts/${id}/cancel`); setRows((x) => x.map((r) => r.id === id ? { ...r, active: false } : r)); toast("اشتراک لغو شد"); } catch (e) { toast((e as Error).message, false); } };
  const unsubscribeToken = async () => { if (!token) return; setBusy(true); try { await api("/api/product-alerts/unsubscribe", "POST", { token }); setDone(true); toast("اشتراک پیامکی لغو شد"); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } };
  return <div className="space-y-5">
    {token && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-3"><BellOff className="size-5 text-amber-800"/><div><b>لغو اعلان‌های این شماره</b><p className="mt-1 text-xs text-slate-600">با تأیید، پیامک‌های مربوط به این اشتراک متوقف می‌شود.</p></div></div>{done ? <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-emerald-800">اشتراک غیرفعال شد.</p> : <button disabled={busy} onClick={unsubscribeToken} className="mt-3 rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "در حال لغو…" : "تأیید لغو اشتراک"}</button>}</section>}
    {!signedIn && <section className="rounded-2xl border bg-white p-5 text-sm leading-7 text-slate-600">برای دیدن گزارش اعلان‌ها وارد حساب شوید. پیوند لغو پیامک بدون ورود نیز کار می‌کند.<Link href="/login" className="mr-2 font-bold text-emerald-800">ورود به حساب</Link></section>}
    {signedIn && <>
      <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center gap-3 border-b p-5"><Bell className="size-5 text-emerald-700"/><div><h2 className="font-black">اشتراک‌های من</h2><p className="mt-1 text-xs text-slate-500">موجودشدن و افت قیمت محصولات منتخب</p></div></div>{busy ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin"/>در حال بارگذاری…</div> : rows.length ? <div className="divide-y">{rows.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div><Link href={row.slug ? `/products/${row.slug}` : "/shop"} className="font-bold text-emerald-950 hover:text-emerald-700">{row.productName ?? "محصول حذف‌شده"}<ExternalLink className="mr-1 inline size-3"/></Link><p className="mt-1 text-xs text-slate-500">{row.variantId ? row.variantTitle ?? "تنوع انتخاب‌شده" : "همه محصول"} · {row.alertRestock ? "موجودشدن" : ""}{row.alertRestock && row.alertPriceDrop ? " و " : ""}{row.alertPriceDrop ? "کاهش قیمت" : ""} · {row.phone}</p></div><div className="flex items-center gap-2">{row.active ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">فعال</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">لغوشده</span>}{row.active && <button onClick={() => cancel(row.id)} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-rose-700">لغو</button>}</div></article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">هنوز اشتراک اعلانی ندارید. در صفحه هر محصول می‌توانید یک اعلان بسازید.</p>}</section>
      <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center gap-3 border-b p-5"><MessageSquareText className="size-5 text-amber-700"/><div><h2 className="font-black">گزارش ارسال پیامک</h2><p className="mt-1 text-xs text-slate-500">وضعیت پذیرش پیام توسط سرویس پیامکی ثبت می‌شود.</p></div></div>{deliveries.length ? <div className="divide-y">{deliveries.map((d, i) => <div key={`${d.subscriptionId}:${i}`} className="flex items-center justify-between gap-3 p-4 text-sm"><span>{d.productName}<small className="mr-2 text-slate-400">{jdate(d.createdAt, true)}</small></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${d.status === "sent" ? "bg-emerald-50 text-emerald-800" : d.status === "failed" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{statusText[d.status] ?? d.status}</span></div>)}</div> : <p className="p-8 text-center text-sm text-slate-500">هنوز پیامی برای این اشتراک‌ها ارسال نشده است.</p>}</section>
    </>}
  </div>;
}
