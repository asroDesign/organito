"use client";

import { useState } from "react";
import { BadgeCheck, Copy, ExternalLink, Link2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, toast } from "./client";
import { Badge, Card, FeatureIntro, Stat } from "./ui";
import { faNum, jdate, toman } from "@/lib/util";

type Data = {
  enabled: boolean;
  config: { minimumWithdrawal: number; attributionDays: number } | null;
  profile: { userId: number; code: string; status: string; tier: string; createdAt: string } | null;
  clicks: number; available: number;
  earnings: { earning: { id: number; orderId: number; productId: number; baseAmount: number; amount: number; rateBps: number; tier: string; status: string; createdAt: string }; orderNumber: string }[];
  withdrawals: { id: number; amount: number; status: string; createdAt: string; adminNote: string | null }[];
};
const STATUS: Record<string, string> = { pending: "در انتظار تکمیل سفارش", active: "فعال", suspended: "تعلیق‌شده", available: "قابل برداشت", paid: "پرداخت‌شده", rejected: "ردشده", void: "لغوشده", reversed: "برگشت‌خورده" };
const TIER: Record<string, string> = { bronze: "برنزی", silver: "نقره‌ای", gold: "طلایی" };

export default function AffiliateCustomerClient({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  const [accept, setAccept] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const action = async (url: string, body: unknown, success: string) => {
    setBusy(true);
    try { const result = await api<{ profile?: Data["profile"] }>(url, "POST", body); toast(success); if (result.profile) setData({ ...data, profile: result.profile }); router.refresh(); }
    catch (e) { toast((e as Error).message, false); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    const link = `${location.origin}/r/${data.profile?.code}`;
    await navigator.clipboard.writeText(link); toast("لینک همکاری کپی شد");
  };
  if (!data.enabled) return <Card><FeatureIntro icon={Link2} title="همکاری در فروش فعلاً فعال نیست" text="پس از فعال‌شدن برنامه توسط مدیریت، می‌توانید برای دریافت لینک اختصاصی درخواست همکاری ثبت کنید." tone="yellow"/></Card>;
  if (!data.profile) return <Card><div className="mx-auto max-w-2xl py-5 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Link2 className="size-7"/></span><h2 className="mt-4 text-xl font-black text-slate-800">درآمد از معرفی محصولات</h2><p className="mt-2 text-sm leading-7 text-slate-500">برای لینک اختصاصی معرفی محصولات درخواست همکاری ثبت کنید. پس از بررسی مدیر، سطح و نرخ پورسانت شما فعال می‌شود.</p><label className="mx-auto mt-5 flex max-w-xl items-start gap-2 rounded-xl bg-slate-50 p-3 text-right text-xs leading-6 text-slate-600"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 accent-emerald-700"/>می‌پذیرم که لینک معرفی را به‌صورت شفاف منتشر کنم و از ارسال پیام ناخواسته یا معرفی گمراه‌کننده خودداری کنم.</label><button disabled={busy || !accept} onClick={() => void action("/api/customer/affiliate/apply", { acceptTerms: true }, "درخواست همکاری ثبت شد")} className="btn-primary mx-auto mt-4">{busy ? "در حال ثبت…" : "ثبت درخواست همکاری"}</button></div></Card>;
  const profile = data.profile;
  return <div className="space-y-5">
    <FeatureIntro icon={BadgeCheck} title="پنل همکاری در فروش" text={profile.status === "active" ? `سطح ${TIER[profile.tier]} · پورسانت سفارش‌ها پس از تکمیل تحویل قابل برداشت می‌شود.` : `وضعیت درخواست: ${STATUS[profile.status] ?? profile.status} · لینک پس از تأیید مدیریت فعال خواهد شد.`} tone={profile.status === "active" ? "green" : "yellow"}/>
    {profile.status === "active" && <Card title="لینک اختصاصی معرفی" action={<Badge tone="green">{TIER[profile.tier]}</Badge>}><div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"><code dir="ltr" className="min-w-0 flex-1 break-all text-sm text-slate-700">{typeof location !== "undefined" ? `${location.origin}/r/${profile.code}` : `/r/${profile.code}`}</code><button onClick={() => void copy()} className="btn-primary"><Copy className="size-4"/>کپی لینک</button></div><p className="mt-2 text-xs leading-6 text-slate-500">اعتبار انتساب: {faNum(data.config?.attributionDays ?? 90)} روز از آخرین ورود با لینک شما. لینک محصول را می‌توانید با افزودن مسیر محصول به پارامتر مقصد به اشتراک بگذارید.</p></Card>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Stat label="کلیک لینک شما" value={faNum(data.clicks)} icon={ExternalLink}/><Stat label="کمیسیون قابل برداشت" value={toman(data.available)} icon={Wallet} tone="green"/><Stat label="کمیسیون در انتظار تکمیل سفارش" value={toman(data.earnings.filter((x) => x.earning.status === "pending").reduce((s, x) => s + x.earning.amount, 0))} icon={Wallet} tone="yellow"/></div>
    {profile.status === "active" && <Card title="درخواست تسویه" ><form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void action("/api/customer/affiliate/withdraw", { amount: Number(amount) }, "درخواست تسویه ثبت شد"); setAmount(""); }}><label className="min-w-52 flex-1 text-xs font-bold text-slate-600">مبلغ (تومان)<input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} type="text" inputMode="numeric" className="input mt-1" placeholder={`حداقل ${Number(data.config?.minimumWithdrawal ?? 100000).toLocaleString("fa-IR")}`} /></label><button disabled={busy || Number(amount) <= 0 || Number(amount) > data.available} className="btn-primary">{busy ? "در حال ثبت…" : "ثبت درخواست برداشت"}</button></form><p className="mt-2 text-xs text-slate-500">وجه به شماره شبا یا کارت ثبت‌شده در بخش کیف پول پرداخت می‌شود. درخواست تا بررسی مدیریت از موجودی قابل برداشت کنار گذاشته می‌شود.</p></Card>}
    <div className="grid gap-5 xl:grid-cols-2"><Card title="سوابق کمیسیون"><div className="space-y-2">{data.earnings.map(({ earning: e, orderNumber }) => <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3"><div className="min-w-0 flex-1"><b className="text-sm">سفارش {orderNumber}</b><p className="mt-1 text-xs text-slate-500">مبنای {toman(e.baseAmount)} · نرخ {(e.rateBps / 100).toLocaleString("fa-IR")}٪ · {TIER[e.tier]}</p></div><b>{toman(e.amount)}</b><Badge>{STATUS[e.status] ?? e.status}</Badge></div>)}{!data.earnings.length && <p className="py-7 text-center text-sm text-slate-500">با خرید مشتریانی که از لینک شما وارد شده‌اند، سوابق کمیسیون اینجا ثبت می‌شود.</p>}</div></Card><Card title="درخواست‌های برداشت"><div className="space-y-2">{data.withdrawals.map((w) => <div key={w.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3"><span className="min-w-0 flex-1 text-sm">{jdate(w.createdAt, true)}{w.adminNote && <small className="mt-1 block text-slate-500">{w.adminNote}</small>}</span><b>{toman(w.amount)}</b><Badge>{STATUS[w.status] ?? w.status}</Badge></div>)}{!data.withdrawals.length && <p className="py-7 text-center text-sm text-slate-500">درخواستی ثبت نشده است.</p>}</div></Card></div>
  </div>;
}
