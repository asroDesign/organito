"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, ShieldCheck, Users, Wallet } from "lucide-react";
import { api, toast } from "./client";
import { Badge, Card, Empty, Stat } from "./ui";
import { faNum, toman } from "@/lib/util";

type Profile = { userId: number; code: string; status: string; tier: string; createdAt: string; approvedAt: string | null };
type Rule = { id: number; productId: number; enabled: boolean; bronzeRateBps: number | null; silverRateBps: number | null; goldRateBps: number | null };
type Product = { id: number; name: string; sku: string; rule: Rule | null };
type AdminData = {
  config: { enabled: boolean; bronzeRateBps: number; silverRateBps: number; goldRateBps: number; minimumWithdrawal: number; attributionDays: number } | null;
  affiliates: { profile: Profile; name: string; phone: string }[];
  products: Product[];
  withdrawals: { withdrawal: { id: number; affiliateUserId: number; amount: number; bankInfo: Record<string, string>; status: string; adminNote: string | null; createdAt: string }; name: string; phone: string }[];
  earnings: { earning: { id: number; affiliateUserId: number; orderId: number; productId: number; baseAmount: number; amount: number; rateBps: number; tier: string; status: string; createdAt: string }; name: string; phone: string; orderNumber: string }[];
  clicks: { userId: number; count: number }[];
};
const STATUS: Record<string, string> = { pending: "در انتظار بررسی", active: "فعال", suspended: "تعلیق‌شده", available: "قابل برداشت", paid: "پرداخت‌شده", rejected: "ردشده", void: "لغوشده", reversed: "برگشت‌خورده" };
const TIER: Record<string, string> = { bronze: "برنزی", silver: "نقره‌ای", gold: "طلایی" };
const pct = (n: number | null | undefined) => n == null ? "" : String(n / 100);

export default function AffiliateAdminClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [withdrawalRefs, setWithdrawalRefs] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<"affiliates" | "products" | "withdrawals" | "earnings">("affiliates");
  const load = async () => { setLoading(true); try { setData(await api<AdminData>("/api/admin/affiliates", "GET")); } catch (e) { toast((e as Error).message, false); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const affiliates = data?.affiliates ?? [];
  const allProducts = data?.products ?? [];
  const filteredProducts = useMemo(() => allProducts.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(query.trim().toLowerCase())), [allProducts, query]);
  const pendingWithdrawals = (data?.withdrawals ?? []).filter((r) => r.withdrawal.status === "pending");
  const saveConfig = async (form: FormData) => {
    setBusy("config");
    try { await api("/api/admin/affiliate-program", "POST", { enabled: form.get("enabled") === "on", bronzeRate: Number(form.get("bronzeRate")), silverRate: Number(form.get("silverRate")), goldRate: Number(form.get("goldRate")), minimumWithdrawal: Number(form.get("minimumWithdrawal")), attributionDays: Number(form.get("attributionDays")) }); toast("تنظیمات همکاری در فروش ذخیره شد"); await load(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(""); }
  };
  const saveProfile = async (userId: number, status: string, nextTier: string) => {
    setBusy(`profile-${userId}`); try { await api(`/api/admin/affiliates/${userId}`, "POST", { status, tier: nextTier }); toast("پروفایل همکار به‌روزرسانی شد"); await load(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(""); }
  };
  const saveRule = async (product: Product, form: FormData) => {
    setBusy(`product-${product.id}`);
    try { await api(`/api/admin/affiliate-products/${product.id}`, "POST", { enabled: form.get("enabled") === "on", bronzeRate: form.get("bronzeRate"), silverRate: form.get("silverRate"), goldRate: form.get("goldRate") }); toast("قانون پورسانت محصول ذخیره شد"); await load(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(""); }
  };
  const processWithdrawal = async (id: number, action: "paid" | "reject") => {
    setBusy(`withdraw-${id}`); try { await api(`/api/admin/affiliate-withdrawals/${id}`, "POST", { action, paymentReference: withdrawalRefs[id]?.trim() }); toast(action === "paid" ? "تسویه ثبت شد" : "درخواست رد شد"); await load(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(""); }
  };
  if (loading && !data) return <div className="grid min-h-52 place-items-center"><Loader2 className="size-7 animate-spin text-emerald-700"/></div>;
  if (!data) return <Card><Empty title="اطلاعات همکاری در فروش بارگذاری نشد" action={<button className="btn-primary" onClick={() => void load()}>تلاش دوباره</button>}/></Card>;
  const tabs = [["affiliates", "همکاران", affiliates.length], ["products", "محصولات مشمول", allProducts.filter((p) => p.rule?.enabled).length], ["withdrawals", "تسویه‌ها", pendingWithdrawals.length], ["earnings", "کمیسیون‌ها", data.earnings.length]] as const;
  const totalPending = data.earnings.filter((x) => x.earning.status === "pending").reduce((n, x) => n + x.earning.amount, 0);
  const totalAvailable = data.earnings.filter((x) => x.earning.status === "available").reduce((n, x) => n + x.earning.amount, 0) - data.withdrawals.filter((x) => x.withdrawal.status === "pending" || x.withdrawal.status === "paid").reduce((n, x) => n + x.withdrawal.amount, 0);
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="همکاران ثبت‌شده" value={faNum(affiliates.length)} icon={Users}/><Stat label="همکاران فعال" value={faNum(affiliates.filter((a) => a.profile.status === "active").length)} icon={ShieldCheck} tone="green"/><Stat label="کمیسیون در انتظار تحویل سفارش" value={toman(totalPending)} icon={Wallet} tone="yellow"/><Stat label="مانده قابل تسویه" value={toman(totalAvailable)} icon={Wallet} tone="violet"/></div>
    <Card title="تنظیمات برنامه" action={<Badge tone={data.config?.enabled ? "green" : "gray"}>{data.config?.enabled ? "برنامه فعال" : "برنامه غیرفعال"}</Badge>}>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" action={(form) => void saveConfig(form)}>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold xl:col-span-2"><input name="enabled" type="checkbox" defaultChecked={data.config?.enabled ?? false} className="accent-emerald-700"/>فعال‌بودن ثبت‌نام و محاسبه پورسانت</label>
        <label className="text-xs font-bold text-slate-600">پورسانت برنزی (%)<input name="bronzeRate" type="number" min="0" max="100" step="0.01" required className="input mt-1" defaultValue={pct(data.config?.bronzeRateBps ?? 300)}/></label>
        <label className="text-xs font-bold text-slate-600">پورسانت نقره‌ای (%)<input name="silverRate" type="number" min="0" max="100" step="0.01" required className="input mt-1" defaultValue={pct(data.config?.silverRateBps ?? 500)}/></label>
        <label className="text-xs font-bold text-slate-600">پورسانت طلایی (%)<input name="goldRate" type="number" min="0" max="100" step="0.01" required className="input mt-1" defaultValue={pct(data.config?.goldRateBps ?? 700)}/></label>
        <label className="text-xs font-bold text-slate-600">حداقل تسویه (تومان)<input name="minimumWithdrawal" type="number" min="1000" required className="input mt-1" defaultValue={data.config?.minimumWithdrawal ?? 100000}/></label>
        <label className="text-xs font-bold text-slate-600">اعتبار معرفی (روز)<input name="attributionDays" type="number" min="1" max="365" required className="input mt-1" defaultValue={data.config?.attributionDays ?? 90}/></label>
        <div className="flex justify-end sm:col-span-2 xl:col-span-6"><button disabled={busy === "config"} className="btn-primary">{busy === "config" ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>}ذخیره تنظیمات</button></div>
      </form>
    </Card>
    <div className="flex flex-wrap gap-2">{tabs.map(([key, label, count]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{label}<span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs">{faNum(count)}</span></button>)}</div>
    {tab === "affiliates" && <Card title="درخواست‌ها و همکاران"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">همکار</th><th className="p-3">کد / کلیک</th><th className="p-3">سطح</th><th className="p-3">وضعیت</th><th className="p-3">عملیات</th></tr></thead><tbody className="divide-y">{affiliates.map(({ profile, name, phone }) => <tr key={profile.userId}><td className="p-3"><b>{name}</b><div className="text-xs text-slate-500" dir="ltr">{phone}</div></td><td className="p-3"><span dir="ltr">{profile.code}</span><div className="text-xs text-slate-500">{faNum(data.clicks.find((x) => x.userId === profile.userId)?.count ?? 0)} کلیک</div></td><td className="p-3"><select aria-label="سطح همکار" className="input !w-32" defaultValue={profile.tier} id={`tier-${profile.userId}`}><option value="bronze">برنزی</option><option value="silver">نقره‌ای</option><option value="gold">طلایی</option></select></td><td className="p-3"><Badge tone={profile.status === "active" ? "green" : profile.status === "suspended" ? "red" : "yellow"}>{STATUS[profile.status] ?? profile.status}</Badge></td><td className="p-3"><div className="flex gap-1"><select aria-label="وضعیت همکار" className="input !w-36" defaultValue={profile.status} id={`status-${profile.userId}`}><option value="pending">در انتظار بررسی</option><option value="active">فعال</option><option value="suspended">تعلیق‌شده</option></select><button disabled={busy === `profile-${profile.userId}`} onClick={() => void saveProfile(profile.userId, (document.getElementById(`status-${profile.userId}`) as HTMLSelectElement).value, (document.getElementById(`tier-${profile.userId}`) as HTMLSelectElement).value)} className="btn-sm">ذخیره</button></div></td></tr>)}</tbody></table>{!affiliates.length && <Empty title="درخواستی برای همکاری ثبت نشده است"/>}</div></Card>}
    {tab === "products" && <Card title="انتخاب محصولات و نرخ اختصاصی"><p className="mb-4 text-sm leading-7 text-slate-500">فقط محصولاتی که فعال می‌کنید پورسانت می‌گیرند. اگر نرخ یک سطح را خالی بگذارید، نرخ عمومی همان سطح اعمال می‌شود.</p><div className="relative mb-3"><Search className="absolute right-3 top-3 size-4 text-slate-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} className="input pr-9" placeholder="جست‌وجوی نام یا SKU محصول"/></div><div className="space-y-3">{filteredProducts.slice(0, 100).map((product) => <form key={product.id} action={(form) => void saveRule(product, form)} className="grid items-center gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(180px,1fr)_repeat(3,100px)_auto]"><div className="min-w-0"><b className="block truncate text-sm">{product.name}</b><small className="text-slate-400" dir="ltr">{product.sku}</small></div><label className="flex items-center gap-1 text-[11px] text-slate-600"><input name="enabled" type="checkbox" defaultChecked={product.rule?.enabled ?? false} className="accent-emerald-700"/>مشمول</label><input name="bronzeRate" type="number" min="0" max="100" step="0.01" className="input" placeholder={`برنزی ${pct(data.config?.bronzeRateBps ?? 300)}%`} defaultValue={pct(product.rule?.bronzeRateBps)}/><input name="silverRate" type="number" min="0" max="100" step="0.01" className="input" placeholder={`نقره‌ای ${pct(data.config?.silverRateBps ?? 500)}%`} defaultValue={pct(product.rule?.silverRateBps)}/><input name="goldRate" type="number" min="0" max="100" step="0.01" className="input" placeholder={`طلایی ${pct(data.config?.goldRateBps ?? 700)}%`} defaultValue={pct(product.rule?.goldRateBps)}/><button disabled={busy === `product-${product.id}`} className="btn-sm">ذخیره</button></form>)}{filteredProducts.length > 100 && <p className="text-center text-xs text-slate-400">برای نمایش سریع، ۱۰۰ نتیجه اول نشان داده می‌شود؛ جستجو را دقیق‌تر کنید.</p>}</div></Card>}
    {tab === "withdrawals" && <Card title="درخواست‌های تسویه"><div className="space-y-3">{data.withdrawals.map(({ withdrawal: w, name, phone }) => <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4"><div className="min-w-0 flex-1"><b>{name}</b><span className="mr-2 text-xs text-slate-500" dir="ltr">{phone}</span><p className="mt-1 text-xs text-slate-500">{toman(w.amount)} · شبا {w.bankInfo.iban || "—"} · کارت {w.bankInfo.cardNumber || "—"}</p></div><Badge tone={w.status === "paid" ? "green" : w.status === "rejected" ? "red" : "yellow"}>{STATUS[w.status]}</Badge>{w.status === "pending" && <><input aria-label="شماره پیگیری پرداخت تسویه" className="input !w-52" placeholder="شماره پیگیری پرداخت" value={withdrawalRefs[w.id] ?? ""} onChange={(e) => setWithdrawalRefs((v) => ({ ...v, [w.id]: e.target.value }))}/><button disabled={busy === `withdraw-${w.id}` || (withdrawalRefs[w.id]?.trim().length ?? 0) < 3} onClick={() => void processWithdrawal(w.id, "paid")} className="btn-success">تأیید تسویه</button><button disabled={busy === `withdraw-${w.id}`} onClick={() => void processWithdrawal(w.id, "reject")} className="btn-ghost text-rose-700">رد</button></>}</div>)}{!data.withdrawals.length && <Empty title="درخواست تسویه‌ای وجود ندارد"/>}</div></Card>}
    {tab === "earnings" && <Card title="دفتر کمیسیون"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">همکار</th><th className="p-3">سفارش</th><th className="p-3">مبنای پورسانت</th><th className="p-3">درصد</th><th className="p-3">کمیسیون</th><th className="p-3">وضعیت</th></tr></thead><tbody className="divide-y">{data.earnings.map(({ earning: e, name, orderNumber }) => <tr key={e.id}><td className="p-3">{name}<small className="block text-slate-400">{TIER[e.tier]}</small></td><td className="p-3">{orderNumber}</td><td className="p-3">{toman(e.baseAmount)}</td><td className="p-3">{pct(e.rateBps)}٪</td><td className="p-3 font-bold">{toman(e.amount)}</td><td className="p-3"><Badge>{STATUS[e.status] ?? e.status}</Badge></td></tr>)}</tbody></table>{!data.earnings.length && <Empty title="هنوز کمیسیونی ثبت نشده است"/>}</div></Card>}
  </div>;
}
