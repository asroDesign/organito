"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Trash2 } from "lucide-react";
import { toast } from "./client";
import { PRODUCT_COMPARE_STORAGE_KEY } from "./ProductCompareButton";
import { Img } from "./ui";
import { currencyUnit } from "@/lib/util";

export type CompareProduct = {
  id: number; slug: string; nameFa: string; brand: string; sku: string; category: string;
  authenticity: string; productType: string; country: string; imageId: number | null;
  minPrice: number; maxPrice: number; available: number; inStock: boolean; inquiryOnly: boolean;
  specs: { k: string; v: string; group?: string; hidden?: boolean }[];
  options: { name: string; values: string[] }[];
  variants: { id: number; title: string; attrs: Record<string, string>; price: number; available: number; unit: string; sellable: boolean; inquiryOnly: boolean }[];
};

function price(value: number) { return value ? `${Number(value).toLocaleString("fa-IR")} ${currencyUnit()}` : "اعلام نشده"; }

export function ProductCompareTable({ products }: { products: CompareProduct[] }) {
  const router = useRouter();
  const ids = products.map((p) => p.id);
  const remove = (id: number) => {
    const next = ids.filter((item) => item !== id);
    localStorage.setItem(PRODUCT_COMPARE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("organo-product-compare-change"));
    router.replace(next.length ? `/compare?ids=${next.join(",")}` : "/compare");
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("پیوند مقایسه کپی شد");
    } catch { toast("کپی پیوند در این مرورگر ممکن نیست", false); }
  };
  const specKeys = [...new Set(products.flatMap((p) => p.specs.filter((s) => !s.hidden && s.k.trim()).map((s) => s.k.trim())))];
  const valuesFor = (product: CompareProduct, key: string) => product.specs.filter((s) => !s.hidden && s.k.trim() === key).map((s) => s.v).filter(Boolean).join("، ") || "—";
  const rowClass = "border-b border-slate-100 last:border-0";
  const labelClass = "sticky right-0 z-10 w-32 min-w-32 bg-slate-50 p-3 text-xs font-bold text-slate-600 sm:w-44 sm:min-w-44 sm:p-4 sm:text-sm";
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-emerald-950">مقایسهٔ محصولات</h1><p className="mt-1 text-sm text-slate-500">مشخصات، قیمت و موجودی محصولات انتخاب‌شده را کنار هم ببینید.</p></div><div className="flex gap-2"><button type="button" onClick={copyLink} disabled={products.length < 2} className="btn-sm"><Copy className="size-4"/>کپی پیوند</button><Link href="/shop" className="btn-primary"><ArrowLeft className="size-4"/>افزودن محصول</Link></div></div>
    {products.length < 2 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">برای مقایسه، دست‌کم دو محصول انتخاب کنید. از آیکن مقایسه در صفحهٔ محصول استفاده کنید؛ حداکثر ۴ محصول هم‌زمان پشتیبانی می‌شود.</div>}
    {!products.length ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Check className="size-7"/></div><h2 className="mt-4 font-black text-slate-800">هنوز محصولی برای مقایسه انتخاب نشده</h2><p className="mt-2 text-sm text-slate-500">به فروشگاه بروید و محصولات موردنظر را از صفحهٔ جزئیات به فهرست مقایسه اضافه کنید.</p><Link href="/shop" className="btn-primary mt-5">رفتن به فروشگاه</Link></div>
      : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-max border-collapse text-right"><thead><tr className="border-b border-slate-200"><th className={`${labelClass} top-0`}>محصول</th>{products.map((p) => <th key={p.id} className="w-64 min-w-56 p-4 align-top sm:w-72 sm:min-w-64"><div className="flex h-full flex-col items-center text-center"><Link href={`/products/${p.slug}`} className="relative grid aspect-square w-full max-w-48 place-items-center overflow-hidden rounded-2xl bg-slate-50">{p.imageId ? <Img id={p.imageId} alt={p.nameFa} className="size-full object-contain"/> : <span className="text-5xl">🌿</span>}</Link><Link href={`/products/${p.slug}`} className="mt-3 line-clamp-2 min-h-10 text-sm font-black leading-6 text-slate-800 hover:text-emerald-700">{p.nameFa}</Link><span className="mt-1 text-xs text-emerald-700">{p.brand}</span><button type="button" onClick={() => remove(p.id)} className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"><Trash2 className="size-3.5"/>حذف از مقایسه</button></div></th>)}</tr></thead>
      <tbody>
        <tr className={rowClass}><th className={labelClass}>قیمت</th>{products.map((p) => <td key={p.id} className="p-4 text-center text-sm font-black text-emerald-800">{p.inquiryOnly ? "استعلام تلفنی" : p.minPrice === p.maxPrice ? price(p.minPrice) : `${price(p.minPrice)} تا ${price(p.maxPrice)}`}</td>)}</tr>
        <tr className={rowClass}><th className={labelClass}>وضعیت و موجودی</th>{products.map((p) => <td key={p.id} className="p-4 text-center">{p.inquiryOnly ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">موجودی با استعلام</span> : <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{p.inStock ? `${p.available.toLocaleString("fa-IR")} موجود` : "ناموجود"}</span>}</td>)}</tr>
        <tr className={rowClass}><th className={labelClass}>دسته‌بندی</th>{products.map((p) => <td key={p.id} className="p-4 text-center text-sm">{p.category || "—"}</td>)}</tr>
        <tr className={rowClass}><th className={labelClass}>نوع محصول</th>{products.map((p) => <td key={p.id} className="p-4 text-center text-sm">{p.productType || "—"}</td>)}</tr>
        <tr className={rowClass}><th className={labelClass}>اصالت / استاندارد</th>{products.map((p) => <td key={p.id} className="p-4 text-center text-sm">{p.authenticity || "—"}</td>)}</tr>
        <tr className={rowClass}><th className={labelClass}>کشور سازنده</th>{products.map((p) => <td key={p.id} className="p-4 text-center text-sm">{p.country || "—"}</td>)}</tr>
        <tr className={rowClass}><th className={labelClass}>کد محصول</th>{products.map((p) => <td key={p.id} dir="ltr" className="p-4 text-center font-mono text-xs">{p.sku}</td>)}</tr>
        {specKeys.map((key) => <tr key={key} className={rowClass}><th className={labelClass}>{key}</th>{products.map((p) => <td key={p.id} className="max-w-72 whitespace-normal p-4 text-center text-sm leading-6">{valuesFor(p, key)}</td>)}</tr>)}
        {products.some((p) => p.options.length) && <tr className={rowClass}><th className={labelClass}>گزینه‌های محصول</th>{products.map((p) => <td key={p.id} className="max-w-72 whitespace-normal p-4 text-center text-sm leading-6">{p.options.map((o) => `${o.name}: ${o.values.join("، ")}`).join(" · ") || "—"}</td>)}</tr>}
        {products.some((p) => p.variants.length) && <tr className={rowClass}><th className={labelClass}>تنوع‌ها</th>{products.map((p) => <td key={p.id} className="p-3 align-top"><div className="space-y-2">{p.variants.length ? p.variants.map((v) => <div key={v.id} className="rounded-xl bg-slate-50 p-2.5 text-xs"><b className="block leading-5">{v.title}</b><span className="mt-1 block text-emerald-800">{p.inquiryOnly || v.inquiryOnly ? "استعلام تلفنی" : price(v.price)}</span><span className="mt-1 block text-slate-500">{p.inquiryOnly || v.inquiryOnly ? "موجودی با استعلام" : v.sellable ? `${v.available.toLocaleString("fa-IR")} ${v.unit}` : "غیرفعال برای فروش"}</span></div>) : <span className="text-xs text-slate-400">تنوعی ثبت نشده</span>}</div></td>)}</tr>}
      </tbody></table></div>}
    <p className="text-xs leading-6 text-slate-400">قیمت و موجودی ممکن است تغییر کند؛ مبلغ نهایی و موجودی معتبر هنگام افزودن به سبد خرید بررسی می‌شود.</p>
  </div>;
}
