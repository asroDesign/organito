"use client";

import { useState } from "react";
import { Code2, Plus, X } from "lucide-react";

type Kind = "products" | "blog-carousel" | "video";
const escapeAttr = (value: string) => value.trim().replace(/["{}]/g, "").slice(0, 180);

/** Inserts a supported content block token into a rich-content field. */
export function ShortcodeInsert({ onInsert }: { onInsert: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("products");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("6");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const insert = () => {
    const count = Math.max(1, Math.min(12, Number(limit) || 6));
    let token = "";
    if (kind === "products") token = `{{products category="${escapeAttr(category)}" limit="${count}"}}`;
    if (kind === "blog-carousel") token = `{{blog-carousel category="${escapeAttr(category)}" limit="${count}"}}`;
    if (kind === "video") token = `{{video url="${escapeAttr(url)}" title="${escapeAttr(title || "ویدیو")}"}}`;
    if (!token || (kind === "video" && !url.trim())) return;
    onInsert(token);
    setOpen(false);
  };

  return <div className="relative my-2">
    <button type="button" className="btn-sm" onClick={() => setOpen(!open)}><Code2 className="size-4"/>افزودن محتوای آماده</button>
    {open && <div className="absolute z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><b className="flex items-center gap-2 text-sm"><Code2 className="size-4 text-emerald-700"/>افزودن شورت‌کد</b><button type="button" className="rounded-lg p-1 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="بستن"><X className="size-4"/></button></div>
      <label className="mb-3 block text-xs text-slate-600">نوع محتوا<select className="input mt-1" value={kind} onChange={e => setKind(e.target.value as Kind)}><option value="products">محصولات یک دسته‌بندی</option><option value="blog-carousel">کاروسل مقاله‌ها</option><option value="video">ویدیوی سایت یا سرویس ویدیویی</option></select></label>
      {kind !== "video" ? <>
        <label className="mb-3 block text-xs text-slate-600">{kind === "products" ? "شناسه یا نشانی دسته‌بندی محصول (خالی = همه محصولات)" : "دسته‌بندی مقاله (خالی = تازه‌ترین مقاله‌ها)"}<input className="input mt-1" value={category} onChange={e => setCategory(e.target.value)} placeholder={kind === "products" ? "مثلاً روغن‌های طبیعی یا 12" : "مثلاً تغذیه سالم"}/></label>
        <label className="mb-3 block text-xs text-slate-600">تعداد کارت<input className="input mt-1" type="number" min="1" max="12" value={limit} onChange={e => setLimit(e.target.value)}/></label>
      </> : <>
        <label className="mb-3 block text-xs text-slate-600">نشانی ویدیو یا شناسه رسانه<input dir="ltr" className="input mt-1 text-left" value={url} onChange={e => setUrl(e.target.value)} placeholder="/api/media/123 یا لینک Aparat / YouTube"/></label>
        <label className="mb-3 block text-xs text-slate-600">عنوان ویدیو<input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="ویدیوی معرفی محصول"/></label>
      </>}
      <p className="mb-3 text-[11px] leading-5 text-slate-400">بلوک در انتهای متن درج می‌شود؛ محل آن را می‌توانید در ویرایشگر تغییر دهید.</p>
      <button type="button" className="btn-primary w-full" onClick={insert}><Plus className="size-4"/>درج در متن</button>
    </div>}
  </div>;
}
