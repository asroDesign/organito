"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toast } from "./client";
import { Barcode } from "./LabelView";

type Initial = { barcodeLabelWidth: number; barcodeLabelHeight: number; barcodeFontSize: number; barcodeShowProductName: number; barcodeShowSku: number };
export function BarcodeDesignManager({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api("/api/admin/settings", "POST", settings); toast("تنظیمات بارکد ذخیره شد"); router.refresh(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } }
  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="mb-3 text-lg font-bold">تنظیمات برچسب بارکد تنوع‌ها</h2>
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div>
        <div className="grid gap-3 sm:grid-cols-3">{[["barcodeLabelWidth", "عرض (mm)"], ["barcodeLabelHeight", "ارتفاع (mm)"], ["barcodeFontSize", "فونت (px)"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input type="number" className="input mt-1" value={Number(settings[key as keyof Initial])} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>)}</div>
        <div className="my-4 flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={!!settings.barcodeShowProductName} onChange={(e) => setSettings({ ...settings, barcodeShowProductName: e.target.checked ? 1 : 0 })} />نام محصول</label><label className="flex items-center gap-2"><input type="checkbox" checked={!!settings.barcodeShowSku} onChange={(e) => setSettings({ ...settings, barcodeShowSku: e.target.checked ? 1 : 0 })} />کد SKU</label></div>
        <button type="button" disabled={busy} className="btn-primary" onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره تنظیمات بارکد</button>
      </div>
      <div className="grid place-items-center rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center" style={{ minHeight: 150, fontSize: settings.barcodeFontSize }}>
        <div style={{ width: `${Math.min(settings.barcodeLabelWidth * 2, 250)}px`, minHeight: `${Math.max(settings.barcodeLabelHeight * 2, 90)}px` }} className="flex flex-col items-center justify-center bg-white p-2 shadow-sm">
          {!!settings.barcodeShowProductName && <b className="block w-full truncate">نمونه محصول ارگانیک</b>}
          <span className="text-xs">تنوع: یک کیلویی</span><div className="my-1 w-full"><Barcode value="ORG-12001" height={32} /></div>
          {!!settings.barcodeShowSku && <span dir="ltr" className="font-mono text-xs">ORG-12001</span>}
        </div>
      </div>
    </div>
  </section>;
}
