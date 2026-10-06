"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toast } from "./client";
import { Barcode } from "./LabelView";

export function InvoiceDesigner({ initial }: { initial: Record<string, string | number> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | number>>(initial);
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string | number) => setValues((old) => ({ ...old, [key]: value }));
  async function save() { setBusy(true); try { await api("/api/admin/settings", "POST", values); toast("طراحی فاکتور ذخیره شد"); router.refresh(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } }
  const flags = ["invoiceShowLogo", "invoiceShowSiteName", "invoiceShowTagline", "invoiceShowHeaderTemplate", "invoiceShowInvoiceBarcode", "invoiceShowSeller", "invoiceShowBuyer", "invoiceShowOfficialInfo", "invoiceShowItems", "invoiceShowTax", "invoiceShowShipping", "invoiceShowPayments", "invoiceShowFooter", "invoiceShowSignatures"];
  const labels = ["لوگو", "نام فروشگاه", "شعار فروشگاه", "قالب سربرگ", "بارکد فاکتور", "مشخصات فروشنده", "مشخصات خریدار", "اطلاعات صورتحساب رسمی", "جدول کالاها", "ستون مالیات", "هزینه ارسال", "اطلاعات پرداخت", "پانویس", "محل امضا"];
  const header = String(values.invoiceHeaderTemplate).replaceAll("{siteName}", String(values.siteName)).replaceAll("{invoiceNumber}", "INV-1405-123").replaceAll("{date}", "۱۴۰۵/۰۷/۱۲");
  const isOn = (key: string) => Number(values[key]) === 1;
  const borderColor = String(values.invoiceBorderColor); const accent = String(values.invoiceAccentColor);
  const border = values.invoiceBorderStyle === "none" ? "none" : `${values.invoiceBorderStyle === "dashed" ? "2px dashed" : "1px solid"} ${borderColor}`;
  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-bold">طراحی فاکتور فروش</h2>
    <p className="mb-4 mt-1 text-sm text-slate-500">اجزای فاکتورهای حضوری و آنلاین، چیدمان سربرگ و ستون‌های مالی را تنظیم کنید؛ پیش‌نمایش زنده است.</p>
    <div className="grid gap-6 xl:grid-cols-[1fr_minmax(320px,0.9fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["invoiceWidth", "عرض چاپ (mm)"], ["invoiceFontSize", "اندازه فونت (px)"], ["invoicePadding", "حاشیه داخلی (mm)"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input type="number" className="input mt-1" value={Number(values[key])} onChange={(e) => set(key, Number(e.target.value))} /></label>)}
          <label className="text-sm">سبک کادر<select className="input mt-1" value={String(values.invoiceBorderStyle)} onChange={(e) => set("invoiceBorderStyle", e.target.value)}><option value="solid">خط ممتد</option><option value="dashed">خط‌چین</option><option value="none">بدون کادر</option></select></label>
          <label className="flex items-center gap-2 text-sm">رنگ کادر<input type="color" className="h-10 w-14 rounded border p-1" value={borderColor} onChange={(e) => set("invoiceBorderColor", e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm">رنگ اصلی<input type="color" className="h-10 w-14 rounded border p-1" value={accent} onChange={(e) => set("invoiceAccentColor", e.target.value)} /></label>
        </div>
        <label className="block text-sm">قالب سربرگ<textarea className="input mt-1 min-h-24 font-mono text-xs" value={String(values.invoiceHeaderTemplate)} onChange={(e) => set("invoiceHeaderTemplate", e.target.value)} /></label>
        <div className="flex flex-wrap gap-1">{[["siteName", "نام فروشگاه"], ["invoiceNumber", "شماره فاکتور"], ["date", "تاریخ"]].map(([key, label]) => <button type="button" key={key} className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800" onClick={() => set("invoiceHeaderTemplate", `${values.invoiceHeaderTemplate}{${key}}`)}>{`{${key}}`} {label}</button>)}</div>
        <label className="block text-sm">متن پایانی فاکتور<textarea className="input mt-1 min-h-16" value={String(values.invoiceFooter)} onChange={(e) => set("invoiceFooter", e.target.value)} /></label>
        <div><b className="mb-2 block text-sm">اجزای قابل نمایش</b><div className="grid gap-2 sm:grid-cols-2">{flags.map((key, i) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs"><input type="checkbox" checked={isOn(key)} onChange={(e) => set(key, e.target.checked ? 1 : 0)} />{labels[i]}</label>)}</div></div>
        <button type="button" disabled={busy} className="btn-primary" onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره طراحی فاکتور</button>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 sm:p-5"><div className="mb-2 text-center text-xs font-bold text-slate-500">پیش‌نمایش زنده فاکتور</div>
        <div className="mx-auto bg-white p-4 text-slate-900 shadow" style={{ width: "100%", maxWidth: `${Math.min(Number(values.invoiceWidth) * 3.3, 600)}px`, padding: `${Number(values.invoicePadding) * 0.55}rem`, fontSize: `${values.invoiceFontSize}px`, border }}>
          <header className="flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: accent }}>
            <div className="flex items-center gap-2">{isOn("invoiceShowLogo") && (Number(values.siteLogoMediaId) ? <img src={`/api/media/${values.siteLogoMediaId}`} alt="لوگو" className="h-10 w-10 object-contain" /> : <span className="grid h-9 w-9 place-items-center rounded bg-emerald-50 text-xs">لوگو</span>)}<div>{isOn("invoiceShowSiteName") && <b className="block" style={{ color: accent }}>{String(values.siteName)}</b>}{isOn("invoiceShowTagline") && <small>{String(values.siteTagline)}</small>}</div></div>
            {isOn("invoiceShowInvoiceBarcode") && <div className="w-20"><Barcode value="INV-1405-123" height={20} /><small dir="ltr">INV-1405-123</small></div>}
          </header>
          {isOn("invoiceShowHeaderTemplate") && <div className="whitespace-pre-line border-b py-2 text-center font-bold" style={{ borderColor }}>{header}</div>}
          {(isOn("invoiceShowSeller") || isOn("invoiceShowBuyer")) && <div className="my-3 grid grid-cols-2 gap-2 text-xs">{isOn("invoiceShowSeller") && <div className="rounded border p-2" style={{ borderColor }}><b style={{ color: accent }}>مشخصات فروشنده</b><div>{String(values.siteName)} · کد اقتصادی</div></div>}{isOn("invoiceShowBuyer") && <div className="rounded border p-2" style={{ borderColor }}><b style={{ color: accent }}>مشخصات خریدار</b><div>نام: علی رضایی</div><div>تلفن: ۰۹۱۲۱۱۱۱۱۱۱</div></div>}</div>}
          {isOn("invoiceShowOfficialInfo") && <div className="mb-2 rounded border border-dashed p-2 text-xs" style={{ borderColor }}>اطلاعات صورتحساب رسمی در صورت ثبت توسط خریدار</div>}
          {isOn("invoiceShowItems") && <table className="w-full border-collapse text-center text-[10px]"><thead><tr style={{ backgroundColor: `${accent}18` }}>{["شرح کالا", "تعداد", "مبلغ واحد", "جمع", ...(isOn("invoiceShowTax") ? ["مالیات"] : [])].map((h) => <th key={h} className="border p-1" style={{ borderColor }}>{h}</th>)}</tr></thead><tbody>{[["عسل طبیعی آویشن", "۱", "۱٬۴۵۰٬۰۰۰", "۱٬۴۵۰٬۰۰۰", "۱۴۵٬۰۰۰"], ["روغن زیتون فرابکر", "۲", "۶۹۰٬۰۰۰", "۱٬۳۸۰٬۰۰۰", "۱۳۸٬۰۰۰"]].map((row, i) => <tr key={i}>{row.slice(0, isOn("invoiceShowTax") ? 5 : 4).map((v, j) => <td key={j} className="border p-1" style={{ borderColor }}>{v}</td>)}</tr>)}</tbody></table>}
          <div className="mt-3 space-y-1 border-t pt-2 text-xs" style={{ borderColor }}><div className="flex justify-between"><span>جمع کالاها و مالیات</span><b>۳٬۱۱۳٬۰۰۰ تومان</b></div>{isOn("invoiceShowShipping") && <div className="flex justify-between"><span>هزینه ارسال</span><span>۸۵٬۰۰۰ تومان</span></div>}<div className="flex justify-between text-sm font-bold" style={{ color: accent }}><span>مبلغ قابل پرداخت</span><span>۳٬۱۹۸٬۰۰۰ تومان</span></div></div>
          {isOn("invoiceShowPayments") && <div className="mt-2 rounded border p-2 text-xs" style={{ borderColor }}>وضعیت پرداخت: پرداخت‌شده · نقدی / کارتخوان</div>}
          {isOn("invoiceShowFooter") && <p className="mt-3 border-t pt-2 text-center text-xs" style={{ borderColor }}>{String(values.invoiceFooter) || "متن پایانی فاکتور"}</p>}
          {isOn("invoiceShowSignatures") && <div className="mt-6 grid grid-cols-2 gap-5 text-center text-[10px]"><div className="border-t pt-1">مهر و امضای فروشنده</div><div className="border-t pt-1">امضای خریدار</div></div>}
        </div>
      </div>
    </div>
  </section>;
}
