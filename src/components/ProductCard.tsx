import Link from "next/link";
import { Star, Store, Flame } from "lucide-react";
import type { ShopProduct } from "@/lib/queries";
import { currencyUnit, faNum } from "@/lib/util";
import { Img } from "./ui";
import { QuickViewButton } from "./QuickView";
import { FavoriteButton } from "./CustomerSelfService";

export function ProductCard({ p }: { p: ShopProduct }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-emerald-900/5 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-lime-300 hover:shadow-xl hover:shadow-emerald-900/10">
      <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-[#f3efe2] to-white">
        <Link href={`/products/${p.slug}`}><Img id={p.imageId} alt={p.nameFa} className={`h-full w-full transition duration-500 group-hover:scale-110 ${p.inStock ? "" : "opacity-60 grayscale"}`} /></Link>
        <div className="absolute right-2 top-2 flex flex-col items-start gap-1">
          {p.certifiedOrganic && <span className="rounded-lg bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white">{p.certificationLabel}</span>}
          {p.festival && <span className="flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: p.festival.color }}><Flame className="h-3 w-3" />جشنواره</span>}
        </div>
        <div className="absolute bottom-2 right-2 z-10"><FavoriteButton productId={p.id}/></div>
        {p.discountPct > 0 && p.inStock && <span className="absolute left-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-rose-500 text-xs font-black text-white shadow-lg">{faNum(p.discountPct)}٪</span>}
        {!p.inStock && <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-slate-900/70 py-1.5 text-center text-xs font-bold text-white">ناموجود — قابل سفارش تأمین</span>}
        <div className="absolute inset-x-2 bottom-2 translate-y-2 opacity-100 transition md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"><QuickViewButton id={p.id} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500"><span className="font-bold text-emerald-700">🌿 {p.brand}</span><span dir="ltr" className="truncate">{p.partNumber}</span></div>
        <Link href={`/products/${p.slug}`} className="line-clamp-2 min-h-10 text-[13px] font-bold leading-5 text-slate-800 hover:text-emerald-700">{p.nameFa}</Link>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {p.reviewCount > 0 ? <span className="flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3 fill-amber-400" />{faNum(p.rating)} <span className="text-slate-400">({faNum(p.reviewCount)})</span></span> : <span className="rounded bg-lime-50 px-1.5 text-lime-700">جدید</span>}
          {p.mv && p.sellers > 1 && <span className="flex items-center gap-0.5"><Store className="h-3 w-3" />{faNum(p.sellers)} فروشنده</span>}
          {p.sold > 0 && <span>· {faNum(p.sold)} فروش</span>}
        </div>
        <div className="mt-auto pt-2">
          {p.compareAt > p.minPrice && p.inStock && <div className="text-left text-xs text-slate-400 line-through">{faNum(p.compareAt)}</div>}
          <div className="flex items-end justify-between">
            <span className="text-[11px] text-slate-400">{p.maxPrice > p.listPrice ? "شروع از" : ""}</span>
            <span className="text-left text-base font-black text-slate-900">{p.minPrice ? faNum(p.minPrice) : "—"} <span className="text-[10px] font-normal text-slate-500">{currencyUnit()}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
