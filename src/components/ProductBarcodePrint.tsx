"use client";
import { useState } from "react";
import Link from "next/link";
import { Barcode } from "./LabelView";

type Variant = { id: number; title: string; sku: string };
export function ProductBarcodePrint({ productName, productSku, variants, width, height, fontSize, showName, showSku, backHref }: {
  productName: string; productSku: string; variants: Variant[]; width: number; height: number; fontSize: number; showName: boolean; showSku: boolean; backHref: string;
}) {
  const [selected, setSelected] = useState<number[]>(variants.map((v) => v.id));
  const visible = variants.filter((v) => selected.includes(v.id));
  const toggle = (id: number) => setSelected((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  return <main className="min-h-screen bg-slate-100 p-5 text-black print:bg-white print:p-0">
    <div className="no-print mx-auto mb-4 max-w-4xl space-y-4">
      <div className="flex items-center justify-between"><Link href={backHref} className="btn-ghost">بازگشت</Link><button type="button" disabled={!visible.length} className="btn-primary" onClick={() => window.print()}>چاپ {visible.length} برچسب انتخاب‌شده</button></div>
      <div className="rounded-xl bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><b>انتخاب تنوع‌ها برای چاپ</b><div className="flex gap-2"><button className="btn-sm" onClick={() => setSelected(variants.map((v) => v.id))}>انتخاب همه</button><button className="btn-sm" onClick={() => setSelected([])}>پاک‌کردن انتخاب</button></div></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{variants.map((v) => <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} /><span className="min-w-0"><b className="block truncate">{v.title}</b><small dir="ltr" className="block text-slate-500">{v.sku || productSku}</small></span></label>)}</div>
      </div>
    </div>
    <div className="barcode-labels mx-auto flex flex-col items-center">
      {visible.map((v) => {
        const code = /^[A-Za-z0-9 .-]+$/.test(v.sku || productSku) ? (v.sku || productSku) : `ORG-${v.id}`;
        return <article key={v.id} className="barcode-label flex flex-col items-center justify-center overflow-hidden bg-white px-2 py-1 text-center" style={{ width: `${width}mm`, height: `${height}mm`, fontSize: `${fontSize}px`, pageBreakAfter: "always", breakAfter: "page" }}>
          {showName && <b className="barcode-product-name block w-full overflow-hidden font-bold" style={{ lineHeight: 1.15, maxHeight: `${fontSize * 2.3}px`, overflowWrap: "anywhere" }}>{productName}</b>}
          <span className="block w-full truncate" style={{ fontSize: `${Math.max(fontSize - 1, 7)}px` }}>{v.title}</span>
          <div className="my-0.5 w-full"><Barcode value={code} height={Math.min(32, Math.max(20, height * 0.85))} /></div>
          {showSku && <span dir="ltr" className="block max-w-full truncate font-mono" style={{ fontSize: `${Math.max(fontSize - 2, 7)}px` }}>{v.sku || productSku}</span>}
        </article>;
      })}
    </div>
    <style>{`@media print { @page { size: ${width}mm ${height}mm; margin: 0; } .barcode-label { width: ${width}mm !important; height: ${height}mm !important; border: 0 !important; margin: 0 !important; } .barcode-labels { display: block !important; } .barcode-labels article { display: flex !important; } }`}</style>
  </main>;
}
