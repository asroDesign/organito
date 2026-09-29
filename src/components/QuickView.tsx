"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Eye, X, Loader2, ArrowLeft, MapPin, Leaf, Sprout, BadgeCheck, CalendarDays } from "lucide-react";
import { BuyBox, type OfferView, type VariantView } from "./BuyBox";
import { Gallery } from "./Gallery";
import { Stars } from "./Community";

export type { OfferView };
type Data = {
  product: {
    id: number; slug: string; nameFa: string; nameEn: string | null; sku: string; partNumber: string; brand: string; country: string | null; authenticity: string; category: string | null;
    shortDesc: string | null; specs: { k: string; v: string }[]; basePrice: number; source: string; available: number; status: string; options: { name: string; values: string[] }[];
    organicInfo: { origin?: string; harvest?: string; method?: string; certificate?: string; suitableFor?: string[] }; videoMediaId: number | null; compareAtPrice: number;
  };
  festival: { title: string; pct: number; color: string; endsAt: string } | null;
  images: number[]; variants: VariantView[]; offers: OfferView[];
  rating: { avg: number; n: number }; store: { multiVendor: boolean; siteName: string; freeShippingOver: number; returnDays: number };
};
const AUTH: Record<string, string> = { Original: "ارگانیک گواهی‌شده", OEM: "طبیعی و بدون افزودنی", Aftermarket: "محلی و سنتی" };
const fa = (n: number) => n.toLocaleString("fa-IR");

export function QuickViewButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={(e) => { e.preventDefault(); setOpen(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white/95 py-2 text-xs font-bold text-emerald-800 shadow-lg ring-1 ring-emerald-900/10 backdrop-blur transition hover:bg-emerald-600 hover:text-white"><Eye className="h-4 w-4" />نمایش سریع</button>
      {open && <QuickViewModal id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickViewModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    fetch(`/api/products/${id}/quick`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); }).catch((e) => setErr(e.message || "خطا در دریافت اطلاعات"));
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [id, onClose]);
  if (!mounted) return null;
  const p = data?.product;
  const org = p?.organicInfo ?? {};
  const facts = p ? ([[MapPin, "خاستگاه", org.origin], [CalendarDays, "برداشت", org.harvest], [Sprout, "روش تولید", org.method], [BadgeCheck, "گواهی", org.certificate]] as const).filter(([, , v]) => v) : [];
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-emerald-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" dir="rtl">
      <div className="qv-in relative my-6 w-full max-w-5xl overflow-hidden rounded-[2rem] bg-[#faf7ef] shadow-2xl ring-1 ring-emerald-900/10">
        <button onClick={onClose} aria-label="بستن" className="absolute left-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-500 shadow ring-1 ring-emerald-900/10 transition hover:rotate-90 hover:text-emerald-700"><X className="h-5 w-5" /></button>
        {!data || !p ? (
          <div className="grid h-96 place-items-center">{err ? <div className="text-sm text-rose-600">{err}</div> : <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />}</div>
        ) : (
          <div className="grid gap-6 p-5 md:grid-cols-2 md:p-7 lg:grid-cols-[1fr_1fr_340px]">
            <div className="lg:col-span-1"><Gallery ids={data.images} alt={p.nameFa} videoId={p.videoMediaId} badge={AUTH[p.authenticity]} /></div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {p.category && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-800 ring-1 ring-amber-200">{p.category}</span>}
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-800 ring-1 ring-emerald-200">🌿 {p.brand}</span>
              </div>
              <h2 className="text-xl font-black leading-9 text-emerald-950">{p.nameFa}</h2>
              <div className="flex items-center gap-2 text-xs"><Stars value={data.rating.avg} size={14} /><span className="text-slate-500">{data.rating.n ? `${fa(data.rating.avg)} از ${fa(data.rating.n)} دیدگاه` : "بدون دیدگاه"}</span></div>
              {p.shortDesc && <p className="text-sm leading-7 text-slate-600">{p.shortDesc.replace(/<[^>]+>/g, " ").slice(0, 260)}</p>}
              {facts.length > 0 && <div className="grid grid-cols-2 gap-2">{facts.map(([I, l, v]) => <div key={l} className="flex items-start gap-2 rounded-2xl bg-white p-2.5 ring-1 ring-emerald-900/5"><I className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div className="min-w-0"><div className="text-[10px] text-slate-500">{l}</div><b className="line-clamp-2 text-xs text-emerald-950">{v}</b></div></div>)}</div>}
              {(org.suitableFor?.length ?? 0) > 0 && <div className="flex flex-wrap gap-1.5">{org.suitableFor!.map((t) => <span key={t} className="flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-0.5 text-[11px] font-bold text-lime-800"><Leaf className="h-3 w-3" />{t}</span>)}</div>}
              {p.specs.length > 0 && <ul className="space-y-1 text-xs">{p.specs.slice(0, 4).map((sp) => <li key={sp.k} className="flex justify-between border-b border-dashed border-emerald-900/10 py-1"><span className="text-slate-500">{sp.k}</span><b className="text-slate-700">{sp.v}</b></li>)}</ul>}
              <Link href={`/products/${p.slug}`} onClick={onClose} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:gap-2 transition-all">مشاهده جزئیات کامل، دیدگاه‌ها و پرسش‌ها<ArrowLeft className="h-4 w-4" /></Link>
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <BuyBox compact onAdded={onClose} product={{ id: p.id, nameFa: p.nameFa, basePrice: p.basePrice, source: p.source, available: p.available, active: p.status === "active", partNumber: p.partNumber }}
                options={p.options} variants={data.variants} offers={data.offers} festival={data.festival} compareAt={p.compareAtPrice}
                multiVendor={data.store.multiVendor} siteName={data.store.siteName} freeShippingOver={data.store.freeShippingOver} returnDays={data.store.returnDays} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
