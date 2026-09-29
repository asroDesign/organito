"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { api, toast, ImageUploader } from "./client";
import { RichEditor } from "./RichEditor";
import { VideoUploader } from "./VideoUploader";

const ORGANIC_FIELDS: [string, string, string][] = [
  ["origin", "خاستگاه / منطقه تولید", "دامنه‌های سبلان، اردبیل"], ["harvest", "زمان برداشت / تولید", "بهار ۱۴۰۵"], ["method", "روش تولید / فرآوری", "کندوی سنتی، بدون تغذیه شکر"],
  ["certificate", "گواهی ارگانیک (مرجع و شماره)", "مؤسسه استاندارد — ۱۲۳۴۵"], ["labTest", "نتیجه آزمون آزمایشگاهی", "ساکارز ۲.۱٪، بدون باقی‌مانده سم"],
  ["ingredients", "ترکیبات", "۱۰۰٪ عسل خالص"], ["storage", "شرایط نگهداری", "دمای اتاق، دور از نور"], ["shelfLife", "ماندگاری", "۲۴ ماه"],
];

type Spec = { k: string; v: string };
type Compat = { make: string; model: string; years: string };
type Variant = { id?: number; title: string; attrs: Record<string, string>; sku: string; price: number; onHand: number; isActive: boolean };
type Opt = { name: string; values: string[] };
export type ProductInitial = Partial<{
  id: number; nameFa: string; nameEn: string | null; sku: string; partNumber: string; oemNumber: string | null; crossRefs: string[]; brand: string; manufacturer: string | null;
  country: string | null; categoryId: number | null; authenticity: string; basePrice: number; compareAtPrice: number; shortDesc: string | null; description: string | null;
  technicalReview: string | null; specs: Spec[]; compatibility: Compat[]; organicInfo: { [k: string]: string | string[] | undefined; suitableFor?: string[] }; videoMediaId: number | null; weight: number | null; barcode: string | null; seoTitle: string | null; metaDesc: string | null; slug: string;
  lowStockThreshold: number; imageIds: number[]; variants: Variant[]; options: Opt[];
}>;

export function ProductForm({ initial = {}, categories, mode, backTo }: { initial?: ProductInitial; categories: { id: number; name: string }[]; mode: "admin" | "seller"; backTo: string }) {
  const router = useRouter();
  const [images, setImages] = useState<number[]>(initial.imageIds ?? []);
  const [specs, setSpecs] = useState<Spec[]>(initial.specs?.length ? initial.specs : [{ k: "", v: "" }]);
  const [org, setOrg] = useState<Record<string, string>>(() => { const o = initial.organicInfo ?? {}; return { ...Object.fromEntries(Object.entries(o).filter(([k]) => k !== "suitableFor")) as Record<string, string>, suitableFor: (o.suitableFor ?? []).join("، ") }; });
  const [desc, setDesc] = useState(initial.description ?? "");
  const [review, setReview] = useState(initial.technicalReview ?? "");
  const [video, setVideo] = useState<number | null>(initial.videoMediaId ?? null);
  const [variants, setVariants] = useState<Variant[]>(initial.variants ?? []);
  const [opts, setOpts] = useState<Opt[]>(initial.options ?? []);
  const [optText, setOptText] = useState<string[]>((initial.options ?? []).map((o) => o.values.join("، ")));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("base");
  const isEdit = !!initial.id;
  const tabs: [string, string][] = [["base", "اطلاعات پایه"], ["content", "توضیحات و بررسی تخصصی"], ["specs", "مشخصات و شناسنامه ارگانیک"], ["media", "تصاویر"], ["price", mode === "admin" ? "قیمت، تنوع و موجودی" : "قیمت و موجودی"], ["seo", "سئو"]];
  const F = ({ name, label, dv, type = "text", ltr, req, half = true }: { name: string; label: string; dv?: string | number | null; type?: string; ltr?: boolean; req?: boolean; half?: boolean }) => (
    <label className={`flex flex-col gap-1 text-sm ${half ? "" : "sm:col-span-2"}`}><span className="text-slate-600">{label}{req && <span className="text-rose-500"> *</span>}</span>
      <input name={name} type={type} defaultValue={dv ?? ""} required={req} className="input" dir={ltr ? "ltr" : undefined} /></label>
  );
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      const payload = { ...fd, crossRefs: String(fd.crossRefs ?? ""), specs: specs.filter((s) => s.k), organicInfo: org, description: desc, technicalReview: review, videoMediaId: video, imageIds: images, variants, options: opts };
      setBusy(true);
      try {
        const r = await api<{ id: number }>(isEdit ? `/api/products/${initial.id}` : "/api/products", isEdit ? "PUT" : "POST", payload);
        toast(mode === "seller" && !isEdit ? "محصول ثبت شد و در انتظار تأیید مدیر است" : "محصول ذخیره شد");
        router.push(backTo.replace(":id", String(r.id)));
        router.refresh();
      } catch (e2) { toast((e2 as Error).message, false); } finally { setBusy(false); }
    }}>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
        {tabs.map(([k, l]) => <button type="button" key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${tab === k ? "bg-emerald-600 font-bold text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>)}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className={tab === "base" ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
          <F name="nameFa" label="نام فارسی" dv={initial.nameFa} req /><F name="nameEn" label="نام انگلیسی" dv={initial.nameEn} ltr />
          <F name="sku" label="SKU" dv={initial.sku} ltr req /><F name="partNumber" label="کد محصول" dv={initial.partNumber} ltr req />
          <F name="oemNumber" label="شماره گواهی ارگانیک" dv={initial.oemNumber} ltr /><F name="crossRefs" label="نام‌های دیگر (با کاما)" dv={initial.crossRefs?.join(", ")} ltr />
          <F name="brand" label="برند" dv={initial.brand} req /><F name="manufacturer" label="سازنده" dv={initial.manufacturer} />
          <F name="country" label="کشور سازنده" dv={initial.country} />
          <label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">دسته‌بندی</span><select name="categoryId" defaultValue={initial.categoryId ?? ""} className="input"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">نوع محصول</span><select name="authenticity" defaultValue={initial.authenticity ?? "Aftermarket"} className="input"><option value="Original">ارگانیک گواهی‌شده</option><option value="OEM">طبیعی و بدون افزودنی</option><option value="Aftermarket">محلی و سنتی</option></select></label>
          <F name="barcode" label="بارکد" dv={initial.barcode} ltr /><F name="weight" label="وزن (گرم)" dv={initial.weight} type="number" />
          {mode === "admin" && !isEdit && <label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">وضعیت اولیه</span><select name="status" className="input"><option value="draft">پیش‌نویس</option><option value="active">فعال</option></select></label>}
        </div>
        <div className={tab === "content" ? "space-y-3" : "hidden"}>
          <label className="block text-sm">توضیح کوتاه<textarea name="shortDesc" defaultValue={initial.shortDesc ?? ""} className="input mt-1 min-h-16" /></label>
          <div className="text-sm"><b className="mb-1.5 block">توضیحات کامل</b><RichEditor value={desc} onChange={setDesc} placeholder="معرفی کامل محصول، روش تولید، نحوه مصرف…" /></div>
          <div className="text-sm"><b className="mb-1.5 block">بررسی تخصصی و ارزش غذایی</b><RichEditor value={review} onChange={setReview} placeholder="بررسی کارشناسی، جدول ارزش غذایی، نتایج آزمایشگاه…" minHeight={200} /></div>
        </div>
        <div className={tab === "specs" ? "grid gap-6 lg:grid-cols-2" : "hidden"}>
          <div className="space-y-2"><b className="text-sm">مشخصات و ارزش غذایی داینامیک</b>
            {specs.map((s, i) => <div key={i} className="flex gap-2"><input value={s.k} placeholder="عنوان" onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} className="input" /><input value={s.v} placeholder="مقدار" onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} className="input" /><button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-500" /></button></div>)}
            <button type="button" className="btn-sm" onClick={() => setSpecs([...specs, { k: "", v: "" }])}><Plus className="h-3 w-3" />افزودن مشخصه</button>
          </div>
          <div className="space-y-3 rounded-2xl bg-lime-50/60 p-4 ring-1 ring-lime-200"><b className="flex items-center gap-2 text-sm text-emerald-900">🌿 شناسنامه محصول ارگانیک</b>
            <div className="grid gap-2 sm:grid-cols-2">
              {ORGANIC_FIELDS.map(([k, l, ph]) => <label key={k} className="text-xs text-slate-600">{l}<input value={org[k] ?? ""} placeholder={ph} onChange={(e) => setOrg({ ...org, [k]: e.target.value })} className="input mt-1" /></label>)}
              <label className="text-xs text-slate-600 sm:col-span-2">مناسب برای / برچسب‌های رژیمی (با کاما)<input value={org.suitableFor ?? ""} placeholder="وگان، بدون گلوتن، کتوژنیک، دیابتی‌ها" onChange={(e) => setOrg({ ...org, suitableFor: e.target.value })} className="input mt-1" /></label>
            </div>
          </div>
        </div>
        <div className={tab === "media" ? "space-y-6" : "hidden"}>
          <div><b className="mb-2 block text-sm">تصاویر و گالری</b><ImageUploader value={images} onChange={setImages} /></div>
          <VideoUploader value={video} onChange={setVideo} />
        </div>
        <div className={tab === "price" ? "space-y-4" : "hidden"}>
          <div className="grid gap-4 sm:grid-cols-3">
            <F name="basePrice" label="قیمت پایه (تومان)" dv={initial.basePrice ?? 0} type="number" /><F name="compareAtPrice" label="قیمت قبل از تخفیف" dv={initial.compareAtPrice ?? 0} type="number" />
            <F name="lowStockThreshold" label="حد هشدار موجودی" dv={initial.lowStockThreshold ?? 3} type="number" />
          </div>
          {mode === "seller" && !isEdit && (
            <div className="grid gap-4 rounded-xl bg-emerald-50 p-4 sm:grid-cols-3">
              <b className="sm:col-span-3 text-sm text-emerald-800">پیشنهاد فروش شما (پس از تأیید محصول فعال می‌شود)</b>
              <F name="offerPrice" label="قیمت فروش" type="number" req /><F name="offerStock" label="موجودی" type="number" req /><F name="offerShipping" label="هزینه ارسال" type="number" />
              <F name="offerPrepDays" label="زمان آماده‌سازی (روز)" type="number" dv={1} /><F name="offerWarranty" label="ضمانت" half={false} />
            </div>
          )}
          {mode === "admin" && (
            <VariantBuilder opts={opts} setOpts={setOpts} optText={optText} setOptText={setOptText} variants={variants} setVariants={setVariants} baseSku={initial.sku ?? ""} basePrice={initial.basePrice ?? 0} />
          )}
        </div>
        <div className={tab === "seo" ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
          <F name="seoTitle" label="SEO Title" dv={initial.seoTitle} /><F name="slug" label="Slug" dv={initial.slug} ltr />
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">Meta Description<textarea name="metaDesc" defaultValue={initial.metaDesc ?? ""} className="input" /></label>
        </div>
      </div>
      <div className="flex gap-2"><button disabled={busy} className="btn-primary">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{isEdit ? "ذخیره تغییرات" : "ثبت محصول"}</button>
        {mode === "seller" && isEdit && <span className="self-center text-xs text-amber-600">تغییر اطلاعات مهم، محصول را مجدداً به صف بررسی می‌فرستد.</span>}</div>
    </form>
  );
}

function combos(opts: Opt[]): Record<string, string>[] {
  return opts.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))), [{}]);
}

function VariantBuilder({ opts, setOpts, optText, setOptText, variants, setVariants, baseSku, basePrice }: {
  opts: Opt[]; setOpts: (o: Opt[]) => void; optText: string[]; setOptText: (t: string[]) => void; variants: Variant[]; setVariants: (v: Variant[]) => void; baseSku: string; basePrice: number;
}) {
  const sync = (names: Opt[], texts: string[]) => {
    setOptText(texts);
    setOpts(names.map((o, i) => ({ name: o.name, values: Array.from(new Set((texts[i] ?? "").split(/[,،]/).map((x) => x.trim()).filter(Boolean))) })));
  };
  const generate = () => {
    const valid = opts.filter((o) => o.name && o.values.length);
    if (!valid.length) { toast("ابتدا حداقل یک پارامتر با مقادیر تعریف کنید", false); return; }
    const key = (a: Record<string, string>) => valid.map((o) => a[o.name]).join("|");
    const old = new Map(variants.map((v) => [key(v.attrs), v]));
    const next = combos(valid).map((a, i) => old.get(key(a)) ?? { title: valid.map((o) => a[o.name]).join(" / "), attrs: a, sku: `${baseSku || "SKU"}-${i + 1}`, price: basePrice, onHand: 0, isActive: true });
    // keep removed-but-existing variants as inactive (they may have reservations)
    const removed = variants.filter((v) => v.id && !next.includes(v)).map((v) => ({ ...v, isActive: false }));
    setOpts(valid);
    setVariants([...next, ...removed.filter((r) => !next.some((n) => key(n.attrs) === key(r.attrs)))]);
  };
  const upd = (i: number, p: Partial<Variant>) => setVariants(variants.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4">
        <b className="text-sm">پارامترهای تنوع (حداکثر ۳ پارامتر؛ مثلاً «برند»، «جنس»، «سمت نصب»)</b>
        <div className="mt-2 space-y-2">
          {opts.map((o, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <input value={o.name} placeholder="نام پارامتر" onChange={(e) => sync(opts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)), optText)} className="input" />
              <input value={optText[i] ?? ""} placeholder="مقادیر با کاما: سرامیکی، نیمه‌فلزی" onChange={(e) => sync(opts, optText.map((t, j) => (j === i ? e.target.value : t)))} className="input" />
              <button type="button" onClick={() => { sync(opts.filter((_, j) => j !== i), optText.filter((_, j) => j !== i)); }}><Trash2 className="h-4 w-4 text-rose-500" /></button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {opts.length < 3 && <button type="button" className="btn-sm" onClick={() => { setOpts([...opts, { name: "", values: [] }]); setOptText([...optText, ""]); }}><Plus className="h-3 w-3" />افزودن پارامتر</button>}
          <button type="button" className="btn-sm !border-emerald-300 !text-emerald-700" onClick={generate}>ساخت ترکیب‌ها ({combos(opts.filter((o) => o.name && o.values.length)).length.toLocaleString("fa-IR")})</button>
        </div>
      </div>
      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="p-2 text-right">ترکیب</th><th className="p-2 text-right">SKU</th><th className="p-2 text-right">قیمت (تومان)</th><th className="p-2 text-right">موجودی اولیه</th><th className="p-2">فعال</th></tr></thead>
            <tbody className="divide-y">
              {variants.map((v, i) => (
                <tr key={i} className={v.isActive ? "" : "opacity-50"}>
                  <td className="p-2"><div className="flex flex-wrap gap-1">{Object.entries(v.attrs).length ? Object.entries(v.attrs).map(([k, val]) => <span key={k} className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{k}: {val}</span>) : <input value={v.title} onChange={(e) => upd(i, { title: e.target.value })} className="input" />}</div></td>
                  <td className="p-2"><input value={v.sku} dir="ltr" onChange={(e) => upd(i, { sku: e.target.value })} className="input" /></td>
                  <td className="p-2"><input type="number" value={v.price} onChange={(e) => upd(i, { price: Number(e.target.value) })} className="input" /></td>
                  <td className="p-2"><input type="number" value={v.onHand} disabled={!!v.id} title={v.id ? "موجودی از بخش انبار تغییر می‌کند" : ""} onChange={(e) => upd(i, { onHand: Number(e.target.value) })} className="input" /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={v.isActive} onChange={(e) => upd(i, { isActive: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">مشتری در صفحه محصول هر پارامتر را جداگانه انتخاب می‌کند و قیمت و موجودی ترکیب انتخاب‌شده نمایش داده می‌شود.</p>
    </div>
  );
}
