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

type Spec = { k: string; v: string; group?: string; hidden?: boolean; order?: number };
type PurchaseOption = { name: string; type: "text" | "select" | "checkbox" | "radio"; required: boolean; values: { label: string; price: number; priceType: "fixed" | "percent" }[] };
type ProductFaq = { question: string; answer: string };
type Compat = { make: string; model: string; years: string };
type Variant = { id?: number; title: string; attrs: Record<string, string>; sku: string; price: number; rewardPoints: number; onHand: number; inventoryUnit: string; baseUnitAmount: number; isActive: boolean; isSellable: boolean };
type Opt = { name: string; values: string[] };
export type ProductInitial = Partial<{
  id: number; nameFa: string; nameEn: string | null; sku: string; partNumber: string; oemNumber: string | null; crossRefs: string[]; brand: string; manufacturer: string | null; source: string;
  country: string | null; categoryId: number | null; authenticity: string; basePrice: number; compareAtPrice: number; shortDesc: string | null; description: string | null;
  technicalReview: string | null; specs: Spec[]; compatibility: Compat[]; organicInfo: { [k: string]: string | string[] | undefined; suitableFor?: string[] }; videoMediaId: number | null; weight: number | null; barcode: string | null; seoTitle: string | null; metaDesc: string | null; slug: string;
  lowStockThreshold: number; allowBackorder: boolean; inventoryBaseUnit: string; imageIds: number[]; variants: Variant[]; options: Opt[]; purchaseOptions: PurchaseOption[]; relatedProductIds: number[]; crossSellProductIds: number[]; productFaqs: ProductFaq[]; deliveryEstimateEnabled: boolean; deliveryMinDays: number; deliveryMaxDays: number; seoKeywords: string[]; seoImageId: number | null;
}>;

function F({ name, label, dv, type = "text", ltr, req, half = true }: { name: string; label: string; dv?: string | number | null; type?: string; ltr?: boolean; req?: boolean; half?: boolean }) {
  return <label className={`flex flex-col gap-1 text-sm ${half ? "" : "sm:col-span-2"}`}><span className="text-slate-600">{label}{req && <span className="text-rose-500"> *</span>}</span><input name={name} type={type} defaultValue={dv ?? ""} required={req} className="input" dir={ltr ? "ltr" : undefined} /></label>;
}

export function ProductForm({ initial = {}, categories, mode, backTo, productChoices = [] }: { initial?: ProductInitial; categories: { id: number; name: string }[]; mode: "admin" | "seller"; backTo: string; productChoices?: { id: number; name: string }[] }) {
  const router = useRouter();
  const [images, setImages] = useState<number[]>(initial.imageIds ?? []);
  const [specs, setSpecs] = useState<Spec[]>(initial.specs?.length ? initial.specs : [{ k: "", v: "" }]);
  const [org, setOrg] = useState<Record<string, string>>(() => { const o = initial.organicInfo ?? {}; return { ...Object.fromEntries(Object.entries(o).filter(([k]) => k !== "suitableFor")) as Record<string, string>, suitableFor: (o.suitableFor ?? []).join("، ") }; });
  const [desc, setDesc] = useState(initial.description ?? "");
  const [review, setReview] = useState(initial.technicalReview ?? "");
  const [video, setVideo] = useState<number | null>(initial.videoMediaId ?? null);
  const [variants, setVariants] = useState<Variant[]>(initial.variants ?? []);
  const [opts, setOpts] = useState<Opt[]>(initial.options ?? []);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>(initial.purchaseOptions ?? []);
  const [faqs, setFaqs] = useState<ProductFaq[]>(initial.productFaqs ?? []);
  const [relatedIds, setRelatedIds] = useState<number[]>(initial.relatedProductIds ?? []);
  const [crossSellIds, setCrossSellIds] = useState<number[]>(initial.crossSellProductIds ?? []);
  const [seoImage, setSeoImage] = useState<number[]>(initial.seoImageId ? [initial.seoImageId] : []);
  const [optText, setOptText] = useState<string[]>((initial.options ?? []).map((o) => o.values.join("، ")));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("base");
  const isEdit = !!initial.id;
  const tabs: [string, string][] = [["base", "اطلاعات پایه"], ["content", "توضیحات و بررسی تخصصی"], ["specs", "مشخصات و شناسنامه ارگانیک"], ["media", "تصاویر"], ["price", mode === "admin" ? "قیمت، تنوع و موجودی" : "قیمت و موجودی"], ["commerce", "گزینه‌ها، ارتباط و تحویل"], ["qa", "پرسش و پاسخ"], ["seo", "سئو"]];
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      const payload = { ...fd, crossRefs: String(fd.crossRefs ?? ""), specs: specs.filter((s) => s.k), organicInfo: org, description: desc, technicalReview: review, videoMediaId: video, imageIds: images, variants, options: opts, purchaseOptions, productFaqs: faqs, relatedProductIds: relatedIds, crossSellProductIds: crossSellIds, seoImageId: seoImage[0] ?? null, deliveryEstimateEnabled: fd.deliveryEstimateEnabled === "on", allowBackorder: fd.allowBackorder === "on", seoKeywords: String(fd.seoKeywords ?? "").split(/[,،\n]/).map((x) => x.trim()).filter(Boolean) };
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
            {specs.map((s, i) => <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 p-2 sm:grid-cols-[1fr_1fr_1fr_72px_auto_auto]"><input value={s.group ?? ""} placeholder="گروه مشخصات" onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))} className="input" /><input value={s.k} placeholder="عنوان" onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} className="input" /><input value={s.v} placeholder="مقدار" onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} className="input" /><input type="number" value={s.order ?? i} title="ترتیب نمایش" aria-label="ترتیب نمایش" onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, order: Number(e.target.value) } : x)))} className="input" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.hidden === true} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, hidden: e.target.checked } : x)))} />مخفی</label><button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-500" /></button></div>)}
            <button type="button" className="btn-sm" onClick={() => setSpecs([...specs, { k: "", v: "", group: "", order: specs.length }])}><Plus className="h-3 w-3" />افزودن مشخصه</button>
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
          {mode === "admin" && <label className="flex flex-wrap items-center gap-3 text-sm"><b className="text-slate-700">واحد پایه انبار</b><select name="inventoryBaseUnit" defaultValue={initial.inventoryBaseUnit ?? "عدد"} className="input w-auto min-w-40"><option value="عدد">عدد</option><option value="گرم">گرم</option><option value="میلی‌لیتر">میلی‌لیتر</option></select><span className="text-xs text-slate-400">مبنای تبدیل تنوع‌ها و بسته‌بندی</span></label>}
          <div className="grid gap-4 sm:grid-cols-3">
            <F name="basePrice" label="قیمت پایه (تومان)" dv={initial.basePrice ?? 0} type="number" /><F name="compareAtPrice" label="قیمت قبل از تخفیف" dv={initial.compareAtPrice ?? 0} type="number" />
            <F name="lowStockThreshold" label="حد هشدار موجودی" dv={initial.lowStockThreshold ?? 3} type="number" />
          </div>
          {mode === "admin" && (!initial.source || initial.source === "central") && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-sm"><input type="checkbox" name="allowBackorder" defaultChecked={initial.allowBackorder ?? false} className="mt-0.5 size-4 accent-emerald-600" /><span><b className="block text-amber-950">فروش بدون کنترل موجودی</b><span className="mt-1 block text-xs leading-5 text-amber-900/80">در صورت فعال‌سازی، خرید با موجودی ناکافی پذیرفته می‌شود. موجودی آزاد می‌تواند منفی شود و هنگام ارسال، کسری موجودی به‌عنوان ورود و سپس خروج ثبت می‌شود.</span></span></label>}
          {mode === "seller" && !isEdit && (
            <div className="grid gap-4 rounded-xl bg-emerald-50 p-4 sm:grid-cols-3">
              <b className="sm:col-span-3 text-sm text-emerald-800">پیشنهاد فروش شما (پس از تأیید محصول فعال می‌شود)</b>
              <F name="offerPrice" label="قیمت فروش" type="number" req /><F name="offerCostPrice" label="قیمت خرید / تمام‌شده" type="number" req /><F name="offerStock" label="موجودی" type="number" req /><F name="offerShipping" label="هزینه ارسال" type="number" />
              <F name="offerPrepDays" label="زمان آماده‌سازی (روز)" type="number" dv={1} /><F name="offerWarranty" label="ضمانت" half={false} />
            </div>
          )}
          {mode === "admin" && (
            <VariantBuilder opts={opts} setOpts={setOpts} optText={optText} setOptText={setOptText} variants={variants} setVariants={setVariants} baseSku={initial.sku ?? ""} basePrice={initial.basePrice ?? 0} baseUnit={initial.inventoryBaseUnit ?? "عدد"} />
          )}
        </div>
        <div className={tab === "commerce" ? "space-y-6" : "hidden"}>
          <DeliveryEditor initial={initial} />
          <ProductPicker title="محصولات مرتبط" choices={productChoices} selected={relatedIds} setSelected={setRelatedIds} />
          <ProductPicker title="محصولات متقابل فروش" choices={productChoices} selected={crossSellIds} setSelected={setCrossSellIds} />
          <PurchaseOptionEditor options={purchaseOptions} setOptions={setPurchaseOptions} />
        </div>
        <div className={tab === "qa" ? "space-y-3" : "hidden"}><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">این پرسش‌ها و پاسخ‌ها پس از ذخیره در صفحه محصول، در بخش پرسش‌وپاسخ کنار پرسش‌های واقعی خریداران نمایش داده می‌شوند.</div>{faqs.map((q, i) => <div key={i} className="grid gap-2 rounded-xl border p-3"><input className="input" placeholder="پرسش متداول" value={q.question} onChange={(e) => setFaqs(faqs.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} /><textarea className="input min-h-20" placeholder="پاسخ" value={q.answer} onChange={(e) => setFaqs(faqs.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} /><button type="button" className="btn-sm w-fit" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" />حذف</button></div>)}<button type="button" className="btn-sm" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}><Plus className="h-3 w-3" />افزودن پرسش و پاسخ</button></div>
        <div className={tab === "seo" ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
          <F name="seoTitle" label="SEO Title" dv={initial.seoTitle} /><F name="slug" label="Slug" dv={initial.slug} ltr />
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">Meta Description<textarea name="metaDesc" defaultValue={initial.metaDesc ?? ""} className="input" /></label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">کلمات کلیدی SEO<input name="seoKeywords" defaultValue={initial.seoKeywords?.join("، ") ?? ""} className="input" placeholder="محصول ارگانیک، خرید عسل، ..." /><small className="text-slate-400">کلمات را با ویرگول جدا کنید.</small></label>
          <div className="text-sm sm:col-span-2"><b className="mb-2 block">تصویر سئو و شبکه‌های اجتماعی</b><ImageUploader value={seoImage} onChange={setSeoImage} max={1} /></div>
        </div>
      </div>
      <div className="flex gap-2"><button disabled={busy} className="btn-primary">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{isEdit ? "ذخیره تغییرات" : "ثبت محصول"}</button>
        {mode === "seller" && isEdit && <span className="self-center text-xs text-amber-600">تغییر اطلاعات مهم، محصول را مجدداً به صف بررسی می‌فرستد.</span>}</div>
    </form>
  );
}

function ProductPicker({ title, choices, selected, setSelected }: { title: string; choices: { id: number; name: string }[]; selected: number[]; setSelected: (v: number[]) => void }) {
  const [q, setQ] = useState("");
  const shown = choices.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return <section className="rounded-xl border p-4"><b className="block text-sm">{title}</b><input className="input mt-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول" /><div className="mt-2 grid max-h-52 gap-1 overflow-y-auto sm:grid-cols-2">{shown.map((p) => <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"><input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />{p.name}</label>)}</div><small className="mt-2 block text-slate-400">{selected.length} محصول انتخاب شده</small></section>;
}
function DeliveryEditor({ initial }: { initial: ProductInitial }) { return <section className="rounded-xl border p-4"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="deliveryEstimateEnabled" defaultChecked={initial.deliveryEstimateEnabled ?? false} />نمایش تاریخ/بازه تحویل مورد انتظار</label><div className="mt-3 grid gap-3 sm:grid-cols-2"><F name="deliveryMinDays" label="حداقل روز کاری" dv={initial.deliveryMinDays ?? 2} type="number" /><F name="deliveryMaxDays" label="حداکثر روز کاری" dv={initial.deliveryMaxDays ?? 5} type="number" /></div></section>; }
function PurchaseOptionEditor({ options, setOptions }: { options: PurchaseOption[]; setOptions: (v: PurchaseOption[]) => void }) {
  const patch = (i: number, p: Partial<PurchaseOption>) => setOptions(options.map((x, j) => j === i ? { ...x, ...p } : x));
  return <section className="space-y-3 rounded-xl border p-4"><b className="text-sm">گزینه‌های محصول</b>{options.map((o, i) => <div key={i} className="space-y-2 rounded-xl bg-slate-50 p-3"><div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]"><input className="input" placeholder="نام گزینه؛ مانند بسته‌بندی هدیه" value={o.name} onChange={(e) => patch(i, { name: e.target.value })} /><select className="input" value={o.type} onChange={(e) => patch(i, { type: e.target.value as PurchaseOption["type"] })}><option value="text">متن</option><option value="select">فهرست انتخاب</option><option value="radio">تک‌انتخابی</option><option value="checkbox">چندانتخابی</option></select><button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-500" /></button></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={o.required} onChange={(e) => patch(i, { required: e.target.checked })} />الزامی</label>{o.type !== "text" && <div className="space-y-1">{o.values.map((v, vi) => <div key={vi} className="grid gap-1 sm:grid-cols-[1fr_120px_120px_auto]"><input className="input" placeholder="عنوان انتخاب" value={v.label} onChange={(e) => patch(i, { values: o.values.map((x, j) => j === vi ? { ...x, label: e.target.value } : x) })} /><input className="input" type="number" min="0" value={v.price} onChange={(e) => patch(i, { values: o.values.map((x, j) => j === vi ? { ...x, price: Number(e.target.value) } : x) })} /><select className="input" value={v.priceType} onChange={(e) => patch(i, { values: o.values.map((x, j) => j === vi ? { ...x, priceType: e.target.value as "fixed" | "percent" } : x) })}><option value="fixed">مبلغ ثابت</option><option value="percent">درصد</option></select><button type="button" onClick={() => patch(i, { values: o.values.filter((_, j) => j !== vi) })}><Trash2 className="h-4 w-4 text-rose-500" /></button></div>)}<button type="button" className="btn-sm" onClick={() => patch(i, { values: [...o.values, { label: "", price: 0, priceType: "fixed" }] })}><Plus className="h-3 w-3" />افزودن انتخاب</button></div>}</div>)}<button type="button" className="btn-sm" onClick={() => setOptions([...options, { name: "", type: "select", required: false, values: [{ label: "", price: 0, priceType: "fixed" }] }])}><Plus className="h-3 w-3" />افزودن گزینه</button></section>;
}

function combos(opts: Opt[]): Record<string, string>[] {
  return opts.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))), [{}]);
}

function VariantBuilder({ opts, setOpts, optText, setOptText, variants, setVariants, baseSku, basePrice, baseUnit }: {
  opts: Opt[]; setOpts: (o: Opt[]) => void; optText: string[]; setOptText: (t: string[]) => void; variants: Variant[]; setVariants: (v: Variant[]) => void; baseSku: string; basePrice: number; baseUnit: string;
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
    const next = combos(valid).map((a, i) => old.get(key(a)) ?? { title: valid.map((o) => a[o.name]).join(" / "), attrs: a, sku: `${baseSku || "SKU"}-${i + 1}`, price: basePrice, rewardPoints: 0, onHand: 0, inventoryUnit: baseUnit, baseUnitAmount: 1, isActive: true, isSellable: true });
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
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="p-2 text-right">ترکیب</th><th className="p-2 text-right">SKU</th><th className="p-2 text-right">واحد شمارش</th><th className="p-2 text-right">هر واحد چند {baseUnit} است؟</th><th className="p-2 text-right">قیمت (تومان)</th><th className="p-2 text-right">امتیاز خرید</th><th className="p-2 text-right">موجودی اولیه</th><th className="p-2">قابل فروش</th><th className="p-2">فعال</th></tr></thead>
            <tbody className="divide-y">
              {variants.map((v, i) => (
                <tr key={i} className={v.isActive ? "" : "opacity-50"}>
                  <td className="p-2"><div className="flex flex-wrap gap-1">{Object.entries(v.attrs).length ? Object.entries(v.attrs).map(([k, val]) => <span key={k} className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{k}: {val}</span>) : <input value={v.title} onChange={(e) => upd(i, { title: e.target.value })} className="input" />}</div></td>
                  <td className="p-2"><input value={v.sku} dir="ltr" onChange={(e) => upd(i, { sku: e.target.value })} className="input" /></td>
                  <td className="p-2"><input value={v.inventoryUnit ?? baseUnit} placeholder="عدد، کیلوگرم…" onChange={(e) => upd(i, { inventoryUnit: e.target.value })} className="input" /></td>
                  <td className="p-2"><input type="number" min="1" step="1" value={v.baseUnitAmount ?? 1} onChange={(e) => upd(i, { baseUnitAmount: Number(e.target.value) })} className="input" /></td>
                  <td className="p-2"><input type="number" value={v.price} onChange={(e) => upd(i, { price: Number(e.target.value) })} className="input" /></td>
                  <td className="p-2"><input type="number" min="0" value={v.rewardPoints ?? 0} onChange={(e) => upd(i, { rewardPoints: Number(e.target.value) })} className="input" /></td>
                  <td className="p-2"><input type="number" value={v.onHand} disabled={!!v.id} title={v.id ? "موجودی از بخش انبار تغییر می‌کند" : ""} onChange={(e) => upd(i, { onHand: Number(e.target.value) })} className="input" /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={v.isSellable !== false} title={v.isSellable ? "در فروشگاه و فروش حضوری قابل عرضه است" : "فقط برای مدیریت انبار و بسته‌بندی"} onChange={(e) => upd(i, { isSellable: e.target.checked })} /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={v.isActive} onChange={(e) => upd(i, { isActive: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">مثال: اگر واحد پایه «گرم» است، برای تنوع فله با واحد «کیلوگرم» مقدار ۱۰۰۰ و برای ظرف ۵۰۰ گرمی با واحد «عدد» مقدار ۵۰۰ بنویسید. موجودی هر تنوع جدا ثبت می‌شود.</p>
      <p className="text-xs text-slate-400">تنوع «فله» را می‌توانید از فروش خارج و فقط برای بسته‌بندی نگه دارید؛ واحد «گرم» ثبت مقادیر اعشاری کیلوگرم را هم ساده می‌کند.</p>
      <p className="text-xs text-slate-400">امتیاز خرید برای هر واحد از هر تنوع پس از پرداخت موفق به مشتری افزوده می‌شود.</p>
    </div>
  );
}
