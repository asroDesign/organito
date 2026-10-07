"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Check, Download, ExternalLink, FileJson2, Loader2, PackageCheck } from "lucide-react";
import { api, toast } from "./client";

type ProductDraft = { nameFa?: string; nameEn?: string; brand?: string; manufacturer?: string; country?: string; shortDesc?: string; description?: string; specs?: { k?: string; v?: string; name?: string; value?: string }[] };

const starter = JSON.stringify({
  nameFa: "نام فارسی محصول",
  nameEn: "Product name",
  brand: "نام برند",
  manufacturer: "",
  country: "",
  shortDesc: "توضیح کوتاه محصول",
  description: "توضیحات محصولی که مجاز به استفاده از آن هستید",
  specs: [{ k: "وزن", v: "۵۰۰ گرم" }, { k: "ترکیبات", v: "نمونه مشخصات" }],
}, null, 2);

export function DigikalaProductImporter({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [sourceReference, setSourceReference] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [raw, setRaw] = useState(starter);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(raw) as ProductDraft;
      if (!value || Array.isArray(value) || typeof value !== "object") return { value: null, error: "ساختار JSON باید یک شیء محصول باشد." };
      return { value, error: "" };
    } catch {
      return { value: null, error: "ساختار JSON معتبر نیست؛ نشانه‌های ویرگول و گیومه را بررسی کنید." };
    }
  }, [raw]);
  const validName = Boolean(parsed.value?.nameFa?.trim() && parsed.value?.brand?.trim());
  const specs = Array.isArray(parsed.value?.specs) ? parsed.value.specs.filter((s) => (s.k ?? s.name)?.trim() && (s.v ?? s.value)?.trim()) : [];

  async function submit() {
    if (!parsed.value || !validName || !sourceReference.trim() || !rightsConfirmed) return;
    setBusy(true);
    try {
      const result = await api<{ id: number; editorUrl: string }>("/api/admin/products/import-digikala", "POST", {
        sourceReference, categoryId: categoryId || null, product: parsed.value, rightsConfirmed,
      });
      toast("محصول به‌صورت پیش‌نویس ساخته شد؛ پیش از انتشار، جزئیات و حقوق تصاویر را بررسی کنید.");
      router.push(result.editorUrl);
      router.refresh();
    } catch (error) {
      toast((error as Error).message, false);
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><FileJson2 className="size-5" /></span>
          <div><h2 className="font-extrabold text-slate-900">اطلاعات محصول مجاز را وارد کنید</h2><p className="mt-1 text-sm leading-6 text-slate-500">لینک یا شناسه فقط برای ثبت منبع است؛ محتوای محصول را به‌شکل JSON وارد کنید تا قبل از ساخت، بازبینی شود.</p></div>
        </div>

        <label className="mb-4 block text-sm font-bold text-slate-700">لینک یا شناسه محصول دیجی‌کالا
          <input dir="ltr" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="https://www.digikala.com/product/dkp-…/ یا شناسه dkp-…" className="input mt-2 text-left" />
        </label>
        <label className="mb-4 block text-sm font-bold text-slate-700">دسته‌بندی فروشگاه
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input mt-2"><option value="">بدون دسته‌بندی</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        </label>

        <label className="block text-sm font-bold text-slate-700">داده ساخت‌یافته محصول <span className="font-normal text-slate-400">(JSON)</span>
          <textarea dir="ltr" spellCheck={false} value={raw} onChange={(e) => setRaw(e.target.value)} rows={16} className="input mt-2 min-h-72 font-mono text-xs leading-6" aria-label="JSON اطلاعات محصول" />
        </label>
        <p className={`mt-2 text-xs ${parsed.error ? "text-rose-600" : "text-slate-500"}`}>{parsed.error || "فیلدهای لازم: nameFa و brand؛ فیلدهای قابل استفاده: nameEn، manufacturer، country، shortDesc، description، specs."}</p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} className="mt-1 size-4 accent-amber-600" />
          <span>تأیید می‌کنم مجوز لازم برای استفاده تجاری از متن و مشخصاتی را که وارد کرده‌ام دارم و حقوق تصاویر و سایر محتواها را جداگانه بررسی می‌کنم.</span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={() => setRaw(starter)}>بازنشانی نمونه</button>
          <button type="button" disabled={busy || !sourceReference.trim() || !validName || Boolean(parsed.error) || !rightsConfirmed} onClick={() => void submit()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}ساخت پیش‌نویس و ویرایش
          </button>
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-extrabold text-slate-900"><PackageCheck className="size-5 text-emerald-700" />پیش‌نمایش محصول</h3>
          {parsed.error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{parsed.error}</p> : <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">نام محصول</div><div className="mt-1 font-bold text-slate-900">{parsed.value?.nameFa?.trim() || "نام فارسی محصول وارد نشده"}</div><div className="mt-1 text-sm text-slate-600">{parsed.value?.brand?.trim() || "برند وارد نشده"}</div></div>
            {parsed.value?.shortDesc && <p className="text-sm leading-6 text-slate-600">{parsed.value.shortDesc}</p>}
            <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800"><Check className="ml-1 inline size-3" />پیش‌نویس</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">قیمت صفر تا تکمیل دستی</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">موجودی وارد نمی‌شود</span></div>
            {specs.length > 0 && <div><div className="mb-2 text-xs font-bold text-slate-500">مشخصات ({specs.length})</div><div className="max-h-48 divide-y overflow-auto rounded-xl border border-slate-100">{specs.slice(0, 8).map((s, i) => <div key={`${s.k ?? s.name}-${i}`} className="flex justify-between gap-3 px-3 py-2 text-xs"><span className="text-slate-500">{s.k ?? s.name}</span><span className="text-left font-medium text-slate-800">{s.v ?? s.value}</span></div>)}</div></div>}
          </div>}
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
          <h3 className="flex items-center gap-2 font-extrabold"><AlertTriangle className="size-5" />واردسازی ایمن و قابل بازبینی</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-sky-900">
            <li>صفحه دیجی‌کالا به‌صورت خودکار خوانده نمی‌شود و هیچ عکسی از آن بارگیری نمی‌شود.</li>
            <li>محصول فقط به‌صورت پیش‌نویس ساخته می‌شود؛ قیمت و موجودی را پس از بررسی دستی تنظیم کنید.</li>
            <li>لینک منبع و شناسه محصول در مشخصات مدیریتی ثبت می‌شود تا پیگیری آسان باشد.</li>
          </ul>
          {sourceReference.startsWith("https://") && <a href={sourceReference} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-sky-800 underline">بازکردن منبع در زبانه جدید<ExternalLink className="size-4" /></a>}
          <p className="mt-4 flex items-start gap-2 border-t border-sky-200 pt-3 text-xs leading-5 text-sky-800"><ArrowUpRight className="mt-0.5 size-4 shrink-0" />تصاویر را فقط از رسانه‌ای استفاده کنید که حق انتشار آن را دارید.</p>
        </div>
      </aside>
    </section>
  </div>;
}
