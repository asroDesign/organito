"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Check, CircleDollarSign, Clock3, Loader2, RefreshCw, Search, Tag } from "lucide-react";
import { api, toast } from "./client";
import { Modal } from "./Modal";
import { faNum, jdate } from "@/lib/util";

type FxRate = { currencyCode: string; currencyName: string; rateValue: number; source: string; updatedAt: string | Date };
type FxTarget = { targetKey: string; productId: number; variantId: number | null; label: string; sku: string; currentPrice: number; cost: number };
type FxRule = { targetKey: string; currencyCode: string; foreignAmount: number; markupPercent: number; roundingStep: number; sourceNote: string | null; lastAppliedRate: number | null; lastAppliedAt: string | Date | null };
type FxPreviewLine = { targetKey: string; productId: number; variantId: number | null; productName: string; sku: string; variantTitle: string | null; currencyCode: string; currencyName: string; rateValue: number; rateSource: string; rateUpdatedAt: string | Date | null; foreignAmount: number; markupPercent: number; roundingStep: number; currentPrice: number; currentReferencePrice: number; newPrice: number | null; newReferencePrice: number | null; cost: number; status: "ready" | "blocked"; reason: string | null };
const CURRENCIES = [{ code: "USD", name: "دلار آمریکا" }, { code: "EUR", name: "یورو" }, { code: "CNY", name: "یوان چین" }, { code: "AED", name: "درهم امارات" }, { code: "TRY", name: "لیر ترکیه" }, { code: "GBP", name: "پوند بریتانیا" }];
const ROUNDING = [1, 10, 100, 1000, 10000, 100000];

function numeric(value: string, decimal: boolean) {
  let raw = value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٬,\s]/g, "");
  raw = raw.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (decimal) { const dot = raw.indexOf("."); if (dot >= 0) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "").slice(0, 4); }
  return raw;
}

export function FxPricingManager({ initialRates, targets, initialRules, currencyUnit }: { initialRates: FxRate[]; targets: FxTarget[]; initialRules: FxRule[]; currencyUnit: string }) {
  const router = useRouter();
  const rates = initialRates;
  const rules = initialRules;
  const [currencyCode, setCurrencyCode] = useState(initialRates[0]?.currencyCode ?? "USD");
  const [currencyName, setCurrencyName] = useState(initialRates[0]?.currencyName ?? "دلار آمریکا");
  const [rateValue, setRateValue] = useState("");
  const [rateSource, setRateSource] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [foreignAmount, setForeignAmount] = useState("");
  const [ruleCurrency, setRuleCurrency] = useState(initialRates[0]?.currencyCode ?? "USD");
  const [markupPercent, setMarkupPercent] = useState("0");
  const [roundingStep, setRoundingStep] = useState("1000");
  const [sourceNote, setSourceNote] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(() => initialRules.map((rule) => rule.targetKey));
  const [preview, setPreview] = useState<{ rows: FxPreviewLine[]; fingerprint: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const money = (value: number | null | undefined) => faNum(value) + " " + currencyUnit;

  const filteredRules = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rules;
    const map = new Map(targets.map((target) => [target.targetKey, target]));
    return rules.filter((rule) => {
      const target = map.get(rule.targetKey);
      return (target?.label + " " + target?.sku + " " + rule.currencyCode).toLocaleLowerCase().includes(query);
    });
  }, [rules, search, targets]);
  const blockedCount = preview?.rows.filter((row) => row.status === "blocked").length ?? 0;

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      await api("/api/admin/fx-rates", "POST", { currencyCode, currencyName, rateValue: Number(numeric(rateValue, false)), source: rateSource });
      toast("نرخ ذخیره شد؛ قیمت محصولات هنوز تغییری نکرده است."); setPreview(null); router.refresh();
    } catch (error) { toast((error as Error).message, false); } finally { setSaving(false); }
  }
  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = targets.find((item) => item.targetKey === targetKey);
    if (!target) { toast("محصول یا تنوع را انتخاب کنید", false); return; }
    setSaving(true);
    try {
      const result = await api<{ targetKey: string }>("/api/admin/fx-product-prices", "POST", {
        productId: target.productId, variantId: target.variantId, currencyCode: ruleCurrency,
        foreignAmount: numeric(foreignAmount, true), markupPercent: Number(markupPercent), roundingStep: Number(roundingStep), sourceNote,
      });
      setSelected((current) => current.includes(result.targetKey) ? current : [...current, result.targetKey]);
      setPreview(null); toast("مبنای ارزی ذخیره شد؛ قیمت منتشرشده هنوز تغییر نکرده است."); router.refresh();
    } catch (error) { toast((error as Error).message, false); } finally { setSaving(false); }
  }
  async function makePreview() {
    if (!selected.length) { toast("حداقل یک قاعده را انتخاب کنید", false); return; }
    setSaving(true);
    try { setPreview(await api<{ rows: FxPreviewLine[]; fingerprint: string }>("/api/admin/fx-pricing/preview", "POST", { targetKeys: selected })); }
    catch (error) { toast((error as Error).message, false); } finally { setSaving(false); }
  }
  async function applyPrices() {
    if (!preview || blockedCount) return;
    setSaving(true);
    try {
      const result = await api<{ applied: number }>("/api/admin/fx-pricing/apply", "POST", { targetKeys: preview.rows.map((row) => row.targetKey), fingerprint: preview.fingerprint, confirm: true });
      toast(faNum(result.applied) + " قیمت به‌روزرسانی شد."); setConfirmOpen(false); setPreview(null); router.refresh();
    } catch (error) { toast((error as Error).message, false); setConfirmOpen(false); setPreview(null); } finally { setSaving(false); }
  }
  function editRule(rule: FxRule) {
    setTargetKey(rule.targetKey); setForeignAmount(String(rule.foreignAmount)); setRuleCurrency(rule.currencyCode);
    setMarkupPercent(String(rule.markupPercent)); setRoundingStep(String(rule.roundingStep)); setSourceNote(rule.sourceNote ?? "");
  }
  function toggle(key: string) {
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); setPreview(null);
  }

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-800"><CircleDollarSign className="size-5" /></span><div><h2 className="font-extrabold">ثبت نرخ مرجع ارز</h2><p className="text-xs text-slate-500">نرخ یک واحد ارز با واحد پول فعلی فروشگاه</p></div></div>
        <form onSubmit={(event) => void saveRate(event)} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">ارز<select className="input mt-1" value={currencyCode} onChange={(event) => { const code = event.target.value; setCurrencyCode(code); setCurrencyName(CURRENCIES.find((item) => item.code === code)?.name ?? code); }}>
            {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
            {rates.filter((rate) => !CURRENCIES.some((item) => item.code === rate.currencyCode)).map((rate) => <option key={rate.currencyCode} value={rate.currencyCode}>{rate.currencyName} ({rate.currencyCode})</option>)}
          </select></label>
          <label className="text-sm">نام ارز<input className="input mt-1" value={currencyName} onChange={(event) => setCurrencyName(event.target.value)} required maxLength={40} /></label>
          <label className="text-sm">نرخ تبدیل<input className="input mt-1" inputMode="numeric" value={rateValue} onChange={(event) => setRateValue(numeric(event.target.value, false))} required placeholder="مثلاً ۶۰۰۰۰۰" /></label>
          <label className="text-sm">منبع و زمان اعلام<input className="input mt-1" value={rateSource} onChange={(event) => setRateSource(event.target.value)} required maxLength={160} placeholder="مثلاً نرخ حواله — ۱۴۰۵/۰۷/۱۵" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs leading-5 text-slate-500">نرخ زنده دریافت نمی‌شود؛ نرخ معتبر را وارد کنید. ثبت نرخ به‌تنهایی قیمت محصول را عوض نمی‌کند.</p><button className="btn-primary" disabled={saving || !rateValue || !rateSource.trim()}>{saving && <Loader2 className="size-4 animate-spin" />}ذخیره نرخ</button></div>
        </form>
        {!!rates.length && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">{rates.map((rate) => <div key={rate.currencyCode} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold">{rate.currencyName} ({rate.currencyCode})</span><span>{money(rate.rateValue)} · <span className="text-xs text-slate-500">{rate.source} · {jdate(rate.updatedAt, true)}</span></span><button type="button" className="btn-sm" onClick={() => { setCurrencyCode(rate.currencyCode); setCurrencyName(rate.currencyName); setRateValue(String(rate.rateValue)); setRateSource(rate.source); }}>ویرایش نرخ</button></div>)}</div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Calculator className="size-5" /></span><div><h2 className="font-extrabold">تعریف مبنای ارزی کالا</h2><p className="text-xs text-slate-500">مبلغ ارزی، ضریب و گردکردن برای محصول یا تنوع</p></div></div>
        <form onSubmit={(event) => void saveRule(event)} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">محصول / تنوع<select className="input mt-1" value={targetKey} onChange={(event) => setTargetKey(event.target.value)} required><option value="">انتخاب کنید…</option>{targets.map((target) => <option key={target.targetKey} value={target.targetKey}>{target.label} · {target.sku}</option>)}</select></label>
          <label className="text-sm">ارز مبنا<select className="input mt-1" value={ruleCurrency} onChange={(event) => setRuleCurrency(event.target.value)} required><option value="">نرخ ثبت‌شده را انتخاب کنید…</option>{rates.map((rate) => <option key={rate.currencyCode} value={rate.currencyCode}>{rate.currencyName} ({rate.currencyCode})</option>)}</select></label>
          <label className="text-sm">مبلغ پایه ارزی<input className="input mt-1" inputMode="decimal" value={foreignAmount} onChange={(event) => setForeignAmount(numeric(event.target.value, true))} required placeholder="مثلاً 12.50" /></label>
          <label className="text-sm">ضریب / کارمزد (٪)<input className="input mt-1" type="number" min={0} max={500} value={markupPercent} onChange={(event) => setMarkupPercent(event.target.value)} required /></label>
          <label className="text-sm">گردکردن رو به بالا<select className="input mt-1" value={roundingStep} onChange={(event) => setRoundingStep(event.target.value)}>{ROUNDING.map((step) => <option key={step} value={step}>{faNum(step)} {step === 1 ? "(بدون گردکردن)" : "واحد"}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">یادداشت قیمت پایه<input className="input mt-1" value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} maxLength={160} placeholder="مثلاً پیش‌فاکتور تأمین‌کننده شماره…" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs leading-5 text-slate-500">ذخیره این قاعده، قیمت منتشرشده را تغییر نمی‌دهد.</p><button className="btn-primary" disabled={saving || !targetKey || !rates.some((rate) => rate.currencyCode === ruleCurrency) || !foreignAmount}>{saving && <Loader2 className="size-4 animate-spin" />}ذخیره مبنا</button></div>
        </form>
      </section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-extrabold">پیش‌نمایش و به‌روزرسانی دسته‌ای</h2><p className="mt-1 text-xs text-slate-500">انتخاب کالا، مشاهده قیمت پیشنهادی و تأیید در مودال؛ قیمت زیر بهای خرید قابل اعمال نیست.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-ghost" onClick={() => { setSelected(selected.length === rules.length ? [] : rules.map((rule) => rule.targetKey)); setPreview(null); }}>{selected.length === rules.length ? "لغو انتخاب همه" : "انتخاب همه قواعد"}</button><button type="button" className="btn-primary" disabled={saving || !selected.length} onClick={() => void makePreview()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}ساخت پیش‌نمایش ({faNum(selected.length)})</button></div></header>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><label className="relative block w-full sm:max-w-sm"><Search className="absolute right-3 top-3 size-4 text-slate-400" /><input className="input pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جستجوی محصول، SKU یا ارز" /></label><p className="text-xs text-slate-500">{faNum(rules.length)} قاعده · {faNum(targets.length)} محصول/تنوع</p></div>
      {!filteredRules.length ? <div className="p-8 text-center text-sm text-slate-500">هنوز مبنای ارزی ثبت نشده است.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-right">انتخاب</th><th className="px-4 py-3 text-right">محصول / SKU</th><th className="px-4 py-3 text-right">مبنای ارزی</th><th className="px-4 py-3 text-right">قیمت فعلی</th><th className="px-4 py-3 text-right">آخرین نرخ اعمال‌شده</th><th className="px-4 py-3 text-right">قاعده</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRules.map((rule) => { const target = targets.find((item) => item.targetKey === rule.targetKey); return <tr key={rule.targetKey} className="hover:bg-slate-50"><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(rule.targetKey)} onChange={() => toggle(rule.targetKey)} aria-label={"انتخاب " + (target?.label ?? rule.targetKey)} className="size-4 accent-emerald-600" /></td><td className="px-4 py-3"><b>{target?.label ?? "کالای حذف‌شده"}</b><div dir="ltr" className="font-mono text-xs text-slate-500">{target?.sku}</div></td><td className="px-4 py-3">{rule.foreignAmount} {rule.currencyCode}<div className="text-xs text-slate-500">{rule.sourceNote || "بدون یادداشت"}</div></td><td className="px-4 py-3">{money(target?.currentPrice ?? 0)}</td><td className="px-4 py-3">{rule.lastAppliedRate ? money(rule.lastAppliedRate) : "اعمال نشده"}</td><td className="px-4 py-3"><button type="button" className="btn-sm" onClick={() => editRule(rule)}><Tag className="size-3" />ویرایش مبنا</button></td></tr>; })}</tbody></table></div>}
    </section>

    {preview && <section className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm"><header className="flex flex-col gap-2 border-b border-sky-100 bg-sky-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-extrabold text-sky-950">پیش‌نمایش محاسبه‌شده</h2><p className="mt-1 text-xs text-sky-800">مبلغ ارزی × نرخ × (۱ + ضریب)؛ سپس گردکردن رو به بالا.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">آماده: {faNum(preview.rows.filter((row) => row.status === "ready").length)} · مسدود: {faNum(blockedCount)}</span></header><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-right">کالا</th><th className="px-4 py-3 text-right">ارز / نرخ</th><th className="px-4 py-3 text-right">فعلی</th><th className="px-4 py-3 text-right">پیشنهادی</th><th className="px-4 py-3 text-right">بهای خرید</th><th className="px-4 py-3 text-right">وضعیت</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.rows.map((row) => <tr key={row.targetKey}><td className="px-4 py-3"><b>{row.productName}{row.variantTitle ? " · " + row.variantTitle : ""}</b><div dir="ltr" className="font-mono text-xs text-slate-500">{row.sku}</div></td><td className="px-4 py-3">{row.foreignAmount} {row.currencyCode} × {faNum(row.rateValue)}<div className="text-xs text-slate-500">ضریب {faNum(row.markupPercent)}٪ · {row.rateSource} · {jdate(row.rateUpdatedAt, true)}</div></td><td className="px-4 py-3">{money(row.currentPrice)}{row.currentReferencePrice > row.currentPrice && <div className="text-xs text-slate-400">قبل از تخفیف: {money(row.currentReferencePrice)}</div>}</td><td className="px-4 py-3 font-bold text-sky-900">{money(row.newPrice)}{row.newReferencePrice ? <div className="text-xs font-normal text-slate-500">قبل از تخفیف: {money(row.newReferencePrice)}</div> : null}</td><td className="px-4 py-3">{money(row.cost)}</td><td className="px-4 py-3">{row.status === "ready" ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="size-4" />آماده</span> : <span className="text-rose-700">{row.reason}</span>}</td></tr>)}</tbody></table></div><footer className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs leading-5 text-slate-500"><Clock3 className="size-4 shrink-0" />هنگام اعمال، نرخ و قیمت دوباره کنترل می‌شوند؛ پیش‌نمایش منقضی رد خواهد شد.</p><button type="button" disabled={!preview.rows.length || blockedCount > 0} className="btn-primary disabled:opacity-50" onClick={() => setConfirmOpen(true)}>تأیید و اعمال قیمت‌ها</button></footer></section>}

    {confirmOpen && preview && <Modal title="تأیید اعمال قیمت‌های ارزی" onClose={() => { if (!saving) setConfirmOpen(false); }}><div className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">قیمت فروش {faNum(preview.rows.length)} ردیف پس از تأیید تغییر می‌کند. تاریخچه قیمت و گزارش ممیزی ثبت می‌شود؛ بهای خرید تغییر نخواهد کرد.</div><div className="max-h-60 overflow-auto rounded-xl border border-slate-200">{preview.rows.map((row) => <div key={row.targetKey} className="flex justify-between gap-3 border-b border-slate-100 px-3 py-2 text-xs last:border-0"><span>{row.productName}{row.variantTitle ? " · " + row.variantTitle : ""}</span><b className="shrink-0">{money(row.currentPrice)} ← {money(row.newPrice)}</b></div>)}</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-ghost" disabled={saving} onClick={() => setConfirmOpen(false)}>بازگشت به پیش‌نمایش</button><button type="button" className="btn-primary" disabled={saving} onClick={() => void applyPrices()}>{saving && <Loader2 className="size-4 animate-spin" />}تأیید و ذخیره</button></div></div></Modal>}
  </div>;
}
