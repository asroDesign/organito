"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Zap, Minus, Plus, Star, Truck, RotateCcw, ShieldCheck, Clock, ChevronDown, Store, Check, Flame, PackageSearch } from "lucide-react";
import { addToCart, toast } from "./client";
import { Countdown } from "./Countdown";
import { currencyUnit } from "@/lib/util";
type PurchaseOption = { name: string; type: "text" | "select" | "checkbox" | "radio"; required: boolean; values: { label: string; price: number; priceType: "fixed" | "percent" }[] };

export type OfferView = { id: number; sellerId: number; shopName: string; rating: number; city: string; price: number; listPrice: number; available: number; shippingCost: number; prepDays: number; warranty: string | null; isBuyBox: boolean; condition: string };
export type VariantView = { id: number; title: string; attrs: Record<string, string>; price: number; compareAtPrice?: number; available: number; isSellable: boolean };
type Choice = { key: string; kind: "central" | "variant" | "offer"; id: number | null; seller: string; price: number; available: number; ship: number | null; prep: number; warranty: string | null; rating?: number; buyBox?: boolean; city: string; variant?: VariantView };

const fa = (n: number) => n.toLocaleString("fa-IR");

export function BuyBox({ product, variants, offers, options = [], purchaseOptions = [], festival, multiVendor, siteName, freeShippingOver, returnDays, compareAt = 0, compact, onAdded }: {
  product: { id: number; nameFa: string; basePrice: number; source: string; available: number; active: boolean; partNumber: string; allowBackorder: boolean };
  variants: VariantView[]; offers: OfferView[]; options?: { name: string; values: string[] }[]; purchaseOptions?: PurchaseOption[];
  festival?: { title: string; pct: number; color: string; endsAt: string } | null; multiVendor: boolean; siteName: string; freeShippingOver: number; returnDays: number; compareAt?: number; compact?: boolean; onAdded?: () => void;
}) {
  const router = useRouter();
  const pct = festival?.pct ?? 0;
  const fp = (n: number) => n - Math.round((n * pct) / 100);

  // All purchasable choices. In single-vendor mode only one "store" option is exposed (central/variant, else buy-box offer).
  const all = useMemo<Choice[]>(() => {
    const list: Choice[] = [];
    if (product.source === "central" && variants.length === 0) list.push({ key: "central", kind: "central", id: null, seller: siteName, price: product.basePrice, available: product.available, ship: null, prep: 1, warranty: "ضمانت اصالت و تازگی", city: "انبار مرکزی" });
    for (const v of variants) if (v.isSellable) list.push({ key: `v:${v.id}`, kind: "variant", id: v.id, seller: siteName, price: v.price, available: v.available, ship: null, prep: 1, warranty: "ضمانت اصالت و تازگی", city: "انبار مرکزی", variant: v });
    for (const o of offers) list.push({ key: `o:${o.id}`, kind: "offer", id: o.id, seller: multiVendor ? o.shopName : siteName, price: o.price, available: o.available, ship: o.shippingCost, prep: o.prepDays, warranty: o.warranty, rating: o.rating, buyBox: o.isBuyBox, city: o.city });
    if (multiVendor) return list;
    const own = list.filter((c) => c.kind !== "offer");
    if (own.some((c) => c.available > 0) || own.length) return own.length ? own : list.slice(0, 1);
    const best = list.filter((c) => c.available > 0).sort((a, b) => Number(b.buyBox) - Number(a.buyBox) || a.price - b.price)[0] ?? list[0];
    return best ? [best] : [];
  }, [product, variants, offers, multiVendor, siteName]);

  const sellableVariants = variants.filter((v) => v.isSellable);
  const hasOpts = options.length > 0 && sellableVariants.length > 0;
  const firstVar = sellableVariants.find((v) => v.available > 0) ?? sellableVariants[0];
  const [sel, setSel] = useState<Record<string, string>>(firstVar?.attrs ?? {});
  const matched = hasOpts ? sellableVariants.find((v) => options.every((o) => v.attrs[o.name] === sel[o.name])) : undefined;
  const sellers = all.filter((c) => c.kind === "offer" || c.kind === "central");
  const variantChoices = all.filter((c) => c.kind === "variant");
  const initial = (hasOpts && matched ? `v:${matched.id}` : undefined) ?? (all.find((c) => c.available > 0) ?? all[0])?.key ?? "";
  const [key, setKey] = useState(initial);
  const cur = all.find((c) => c.key === (hasOpts && matched ? `v:${matched.id}` : key)) ?? (hasOpts && !matched ? undefined : all[0]);
  const [qty, setQty] = useState(1);
  const [showSellers, setShowSellers] = useState(false);
  const [purchaseSelection, setPurchaseSelection] = useState<Record<string, string | string[]>>({});
  const optionExtra = purchaseOptions.reduce((sum, option) => { const chosen = purchaseSelection[option.name]; const labels = Array.isArray(chosen) ? chosen : chosen ? [chosen] : []; return sum + labels.reduce((n, label) => { const choice = option.values.find((v) => v.label === label); return n + (choice ? choice.priceType === "percent" ? Math.round((listPrice * choice.price) / 100) : choice.price : 0); }, 0); }, 0);
  const missingRequired = purchaseOptions.some((o) => { const value = purchaseSelection[o.name]; return o.required && (!value || (Array.isArray(value) && value.length === 0)); });
  const canBuy = !!cur && (cur.available > 0 || (product.allowBackorder && cur.kind !== "offer")) && product.active;
  const maxQty = product.allowBackorder && cur?.kind !== "offer" ? 100 : Math.min(100, cur?.available ?? 1);
  const listPrice = cur?.price ?? 0;
  const selectedCompareAt = cur?.kind === "variant" && (cur.variant?.compareAtPrice ?? 0) > 0 ? cur.variant!.compareAtPrice! : compareAt;
  const strike = pct > 0 ? listPrice : selectedCompareAt > listPrice && cur?.kind !== "offer" ? selectedCompareAt : 0;
  const final = fp(listPrice + optionExtra);
  const off = strike ? Math.round(((strike - final) / strike) * 100) : 0;

  const add = (go: boolean) => {
    if (!cur) return;
    if (missingRequired) { toast("لطفاً گزینه‌های ضروری محصول را انتخاب کنید", false); return; }
    addToCart({ selectedOptions: purchaseSelection, productId: product.id, offerId: cur.kind === "offer" ? cur.id : null, variantId: cur.kind === "variant" ? cur.id : null, qty, title: cur.variant ? `${product.nameFa} — ${cur.variant.title}` : product.nameFa, seller: cur.seller });
    onAdded?.();
    if (go) router.push("/cart");
  };

  return (
    <div className={`overflow-hidden rounded-[1.75rem] bg-white shadow-xl shadow-emerald-900/5 ring-1 ring-emerald-900/10 ${compact ? "" : ""}`}>
      {festival && pct > 0 && (
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 text-xs text-white" style={{ background: `linear-gradient(90deg, ${festival.color}, #9a3412)` }}>
          <span className="flex items-center gap-1.5 font-bold"><Flame className="h-4 w-4" />{festival.title}</span><Countdown to={festival.endsAt} compact />
        </div>
      )}
      <div className="space-y-5 p-5">
        <div className="flex items-end justify-between gap-2">
          <div>
            {strike > 0 && <div className="flex items-center gap-2"><s className="text-sm text-slate-400">{fa(strike)}</s><span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white">{fa(off)}٪</span></div>}
            <div className={`${compact ? "text-2xl" : "text-3xl"} font-black tracking-tight text-emerald-950`}>{cur ? fa(final) : "—"} <span className="text-sm font-medium text-slate-500">{currencyUnit()}</span></div>
          </div>
          {cur?.variant && <span className="rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">{cur.variant.title}</span>}
        </div>

        {hasOpts && (
          <div className="space-y-3">
            {options.map((o) => (
              <div key={o.name}>
                <div className="mb-2 text-xs font-bold text-slate-600">{o.name}: <span className="text-emerald-700">{sel[o.name] ?? "—"}</span></div>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((val) => {
                    const next = { ...sel, [o.name]: val };
                    const v = sellableVariants.find((x) => options.every((op) => x.attrs[op.name] === next[op.name]));
                    const on = sel[o.name] === val;
                    return (
                      <button key={val} type="button" onClick={() => { setSel(next); if (v) setKey(`v:${v.id}`); }}
                        className={`relative rounded-2xl border-2 px-3.5 py-2 text-sm transition ${on ? "border-emerald-600 bg-emerald-50 font-bold text-emerald-900" : v && v.available > 0 ? "border-slate-200 hover:border-emerald-300" : "border-dashed border-slate-200 text-slate-400"}`}>
                        {on && <Check className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-full bg-emerald-600 p-0.5 text-white" />}{val}
                        {v && <span className="mr-1.5 text-[10px] font-normal text-slate-500">{fa(fp(v.price))}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!matched && <div className="rounded-xl bg-rose-50 p-2 text-xs text-rose-700">این ترکیب موجود نیست؛ گزینه دیگری انتخاب کنید.</div>}
          </div>
        )}
        {!hasOpts && variantChoices.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-bold text-slate-600">انتخاب تنوع و قیمت</div>
            <div className="grid grid-cols-2 gap-2">
              {variantChoices.map((c) => (
                <button key={c.key} type="button" onClick={() => setKey(c.key)} className={`rounded-2xl border-2 p-2.5 text-right text-xs transition ${key === c.key ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"} ${c.available <= 0 ? "opacity-50" : ""}`}>
                  <b className="block text-slate-900">{c.variant?.title}</b><span className="font-black text-emerald-800">{fa(fp(c.price))}</span> <span className="text-slate-400">{currencyUnit()}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {cur && (
          <div className="rounded-2xl bg-[#faf7ef] p-3.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-emerald-900/10"><Store className="h-4 w-4" /></span><span><b className="block text-emerald-950">{cur.seller}</b><span className="text-[11px] text-slate-500">{multiVendor ? cur.city : "ارسال از انبار فروشگاه"}</span></span></span>
              {multiVendor && cur.rating ? <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400" />{fa(cur.rating)}</span> : null}
            </div>
            {multiVendor && sellers.length > 1 && (
              <button type="button" onClick={() => setShowSellers(!showSellers)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-900/10">
                <span>{fa(sellers.length - 1)} فروشنده دیگر — از {fa(fp(Math.min(...sellers.map((x) => x.price))))} {currencyUnit()}</span><ChevronDown className={`h-4 w-4 transition ${showSellers ? "rotate-180" : ""}`} />
              </button>
            )}
            {multiVendor && showSellers && (
              <div className="mt-2 space-y-1.5">
                {sellers.map((c) => (
                  <button key={c.key} type="button" onClick={() => { setKey(c.key); setShowSellers(false); }} className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white p-2.5 text-right text-xs ${key === c.key ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-300"}`}>
                    <span><b className="block">{c.seller}{c.buyBox && <span className="mr-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">پیشنهاد برتر</span>}</b><span className="text-slate-500">{c.city} · ارسال {c.ship === null ? "با پست فروشگاه" : `${fa(c.ship)} ت`} · {fa(c.prep)} روز</span></span>
                    <span className="text-left"><b className="block text-sm">{fa(fp(c.price))}</b><span className={c.available > 0 || (product.allowBackorder && c.kind !== "offer") ? "text-emerald-600" : "text-rose-500"}>{c.available > 0 ? `${fa(c.available)} عدد` : product.allowBackorder && c.kind !== "offer" ? "قابل سفارش" : "ناموجود"}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {cur && cur.available > 0 && cur.available <= 10 && (
          <div><div className="mb-1 flex justify-between text-[11px]"><span className="font-bold text-rose-600">فقط {fa(cur.available)} عدد در انبار باقی مانده</span></div><div className="h-1.5 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-gradient-to-l from-rose-500 to-amber-400" style={{ width: `${Math.max(8, cur.available * 10)}%` }} /></div></div>
        )}

        {purchaseOptions.length > 0 && <div className="space-y-3 rounded-2xl border border-slate-100 p-3">{purchaseOptions.map((o) => <label key={o.name} className="block text-xs font-bold text-slate-700">{o.name}{o.required && <span className="text-rose-500"> *</span>}{o.type === "text" ? <input className="input mt-1" value={String(purchaseSelection[o.name] ?? "")} onChange={(e) => setPurchaseSelection({ ...purchaseSelection, [o.name]: e.target.value })} /> : <>{o.type === "select" ? <select className="input mt-1" value={String(purchaseSelection[o.name] ?? "")} onChange={(e) => setPurchaseSelection({ ...purchaseSelection, [o.name]: e.target.value || "" })}><option value="">انتخاب کنید</option>{o.values.map((v) => <option key={v.label} value={v.label}>{v.label}{v.price ? ` (+${fa(v.price)}${v.priceType === "percent" ? "٪" : ` ${currencyUnit()}`})` : ""}</option>)}</select> : <div className="mt-2 flex flex-wrap gap-3">{o.values.map((v) => { const current = purchaseSelection[o.name]; const on = Array.isArray(current) ? current.includes(v.label) : current === v.label; return <label key={v.label} className="flex items-center gap-1.5 font-normal"><input type={o.type === "checkbox" ? "checkbox" : "radio"} name={`purchase-${o.name}`} checked={on} onChange={(e) => setPurchaseSelection({ ...purchaseSelection, [o.name]: o.type === "checkbox" ? (e.target.checked ? [...(Array.isArray(current) ? current : []), v.label] : (Array.isArray(current) ? current : []).filter((x) => x !== v.label)) : v.label })} />{v.label}{v.price ? ` (+${fa(v.price)}${v.priceType === "percent" ? "٪" : ` ${currencyUnit()}`})` : ""}</label>; })}</div>}</>}</label>)}</div>}
        {canBuy ? (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <div className="flex items-center rounded-2xl border-2 border-slate-200">
                <button type="button" className="p-3 disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-black">{fa(qty)}</span>
                <button type="button" className="p-3 disabled:opacity-30" disabled={qty >= maxQty} onClick={() => setQty(qty + 1)}><Plus className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={() => add(false)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-700 py-3.5 font-black text-white shadow-lg shadow-emerald-600/30 transition hover:from-emerald-700 hover:to-emerald-800"><ShoppingBag className="h-5 w-5" />افزودن به سبد</button>
            </div>
            <button type="button" onClick={() => add(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 py-3 font-black text-emerald-950 transition hover:bg-lime-300"><Zap className="h-4 w-4" />خرید فوری — {fa(final * qty)} {currencyUnit()}</button>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-center">
            <b className="block text-slate-700">{product.active ? "در حال حاضر موجود نیست" : "این محصول فعلاً قابل فروش نیست"}</b>
            <Link href={`/customer/supply?pn=${encodeURIComponent(product.partNumber)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200"><PackageSearch className="h-4 w-4" />ثبت سفارش ویژه / خبرم کن</Link>
          </div>
        )}

        {!compact && (
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-emerald-600" />آماده‌سازی {fa(cur?.prep ?? 1)} روز کاری</span>
            <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-emerald-600" />{cur?.ship ? `ارسال ${fa(cur.ship)} ${currencyUnit()}` : `ارسال رایگان بالای ${fa(freeShippingOver / 1000000)} میلیون`}</span>
            <span className="flex items-center gap-1.5"><RotateCcw className="h-4 w-4 text-emerald-600" />{fa(returnDays)} روز ضمانت بازگشت</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />{cur?.warranty ?? "ضمانت اصالت"}</span>
          </div>
        )}
      </div>

      {!compact && canBuy && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-emerald-900/10 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">{strike > 0 && <s className="text-[11px] text-slate-400">{fa(strike)}</s>}<div className="font-black text-emerald-950">{fa(final)} <span className="text-[11px] font-normal">{currencyUnit()}</span></div></div>
          <button type="button" onClick={() => add(false)} className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"><ShoppingBag className="h-4 w-4" />افزودن به سبد</button>
        </div>
      )}
    </div>
  );
}
