"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toast } from "./client";
import { LabelView, type LabelConfig } from "./LabelView";

const PH: [string, string][] = [["receiver", "نام گیرنده"], ["senderPhone", "تلفن فرستنده"], ["senderPostalCode", "کد پستی فرستنده"], ["total", "مبلغ سفارش"], ["payment", "وضعیت پرداخت"], ["phone", "تلفن"], ["city", "شهر"], ["address", "آدرس"], ["postalCode", "کد پستی"], ["order", "شماره سفارش"], ["shipment", "شماره مرسوله"], ["carrier", "شرکت حمل"], ["tracking", "کد رهگیری"], ["packages", "تعداد بسته"], ["sender", "فرستنده"], ["date", "تاریخ"]];
const SAMPLE = { total: "۲٬۹۷۰٬۵۸۰ تومان", payment: "پرداخت‌شده", senderPhone: "", senderPostalCode: "", receiver: "علی رضایی", phone: "09121111111", city: "تهران", address: "خیابان ولیعصر، کوچه نسترن، پلاک ۸", postalCode: "1968913111", order: "YT-1234567", shipment: "42", carrier: "پست پیشتاز", tracking: "TPX-88213094", packages: "۲", sender: "", senderAddress: "", date: "۱۴۰۵/۰۷/۰۴", barcode: "TPX-88213094" };
const PRESETS: [string, number, number][] = [["A6 (۱۰۵×۱۴۸)", 105, 148], ["۱۰۰×۱۵۰ حرارتی", 100, 150], ["۱۰۰×۱۰۰", 100, 100], ["A5 (۱۴۸×۲۱۰)", 148, 210]];

export function LabelDesigner({ initial }: { initial: LabelConfig }) {
  const router = useRouter();
  const [c, setC] = useState<LabelConfig>(initial);
  const [busy, setBusy] = useState(false);
  const insert = (k: string) => setC({ ...c, labelTemplate: `${c.labelTemplate}{${k}}` });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <div className="flex flex-wrap gap-2">{PRESETS.map(([l, w, h]) => <button key={l} className="btn-sm" onClick={() => setC({ ...c, labelWidth: w, labelHeight: h })}>{l}</button>)}</div>
        <div className="grid grid-cols-3 gap-3">
          <label>عرض (mm)<input type="number" value={c.labelWidth} onChange={(e) => setC({ ...c, labelWidth: Number(e.target.value) })} className="input mt-1" /></label>
          <label>ارتفاع (mm)<input type="number" value={c.labelHeight} onChange={(e) => setC({ ...c, labelHeight: Number(e.target.value) })} className="input mt-1" /></label>
          <label>اندازه فونت<input type="number" value={c.labelFontSize} onChange={(e) => setC({ ...c, labelFontSize: Number(e.target.value) })} className="input mt-1" /></label>
        </div>
        <div className="flex flex-wrap gap-4">
          {([["labelShowBarcode", "بارکد رهگیری"], ["labelShowOrderBarcode", "بارکد شماره سفارش"], ["labelShowSender", "اطلاعات فرستنده"], ["labelShowItems", "فهرست اقلام"], ["labelShowLogo", "لوگو"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked ? 1 : 0 })} />{l}</label>
          ))}
        </div>
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          <b className="sm:col-span-2">مشخصات فرستنده (از تنظیمات سامانه)</b>
          <label>نام فرستنده<input value={c.senderName} onChange={(e) => setC({ ...c, senderName: e.target.value })} className="input mt-1" /></label>
          <label>شهر<input value={c.senderCity ?? ""} onChange={(e) => setC({ ...c, senderCity: e.target.value })} className="input mt-1" /></label>
          <label className="sm:col-span-2">آدرس<input value={c.senderAddress} onChange={(e) => setC({ ...c, senderAddress: e.target.value })} className="input mt-1" /></label>
          <label>تلفن<input value={c.senderPhone ?? ""} onChange={(e) => setC({ ...c, senderPhone: e.target.value })} dir="ltr" className="input mt-1" /></label>
          <label>کد پستی<input value={c.senderPostalCode ?? ""} onChange={(e) => setC({ ...c, senderPostalCode: e.target.value })} dir="ltr" className="input mt-1" /></label>
          <label>کادر لیبل<select value={c.labelBorderStyle ?? "solid"} onChange={(e) => setC({ ...c, labelBorderStyle: e.target.value })} className="input mt-1"><option value="solid">خط ممتد</option><option value="dashed">خط‌چین</option><option value="none">بدون کادر</option></select></label>
        </div>
        <label className="block">متن لیبل
          <textarea value={c.labelTemplate} onChange={(e) => setC({ ...c, labelTemplate: e.target.value })} className="input mt-1 min-h-48 font-mono text-xs" /></label>
        <div className="flex flex-wrap gap-1">{PH.map(([k, l]) => <button key={k} className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700" onClick={() => insert(k)} title={l}>{`{${k}}`} {l}</button>)}</div>
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">راهنما: خط شروع‌شده با <code># </code> تیتر درشت · <code>---</code> خط جداکننده · <code>! </code> کادر هشدار. متغیرها داخل آکولاد جایگزین می‌شوند.</div>
        <button disabled={busy} className="btn-primary" onClick={async () => {
          setBusy(true);
          try { await api("/api/admin/settings", "POST", { labelWidth: c.labelWidth, labelHeight: c.labelHeight, labelFontSize: c.labelFontSize, labelShowBarcode: c.labelShowBarcode, labelShowSender: c.labelShowSender, labelShowItems: c.labelShowItems, labelTemplate: c.labelTemplate, labelShowLogo: c.labelShowLogo ?? 0, labelShowOrderBarcode: c.labelShowOrderBarcode ?? 0, labelBorderStyle: c.labelBorderStyle ?? "solid", senderName: c.senderName, senderAddress: c.senderAddress, senderCity: c.senderCity ?? "", senderPhone: c.senderPhone ?? "", senderPostalCode: c.senderPostalCode ?? "" }); toast("طرح لیبل ذخیره شد"); router.refresh(); }
          catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
        }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره طرح</button>
      </div>
      <div className="rounded-2xl bg-slate-200 p-4"><div className="mb-2 text-center text-xs text-slate-500">پیش‌نمایش</div><LabelView cfg={c} data={SAMPLE} items={["عسل طبیعی آویشن × ۱", "روغن زیتون فرابکر × ۲"]} /></div>
    </div>
  );
}
