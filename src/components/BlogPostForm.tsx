"use client";
import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Send, Tag, X } from "lucide-react";
import { api, ImageUploader, toast } from "./client";
import { RichEditor } from "./RichEditor";
import { ShortcodeInsert } from "./ShortcodeInsert";
import { VideoUploader } from "./VideoUploader";

export type BlogPostInput = {
  id?: number; title: string; slug: string; excerpt: string | null; content: string; coverImageId: number | null; category: string; tags: string[];
  seoTitle: string | null; metaDescription: string | null; canonicalUrl: string | null; status: string; contentType?: string; videoMediaId?: number | null; audioMediaId?: number | null; reviewNote?: string | null;
};

const EMPTY: BlogPostInput = { title: "", slug: "", excerpt: "", content: "", coverImageId: null, category: "سلامت و سبک زندگی", tags: [], seoTitle: "", metaDescription: "", canonicalUrl: "", status: "draft", contentType: "text", videoMediaId: null, audioMediaId: null };

export function BlogPostForm({ initial, categories = [], availableTags = [], canPublish = false }: { initial?: BlogPostInput; categories?: string[]; availableTags?: string[]; canPublish?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial ?? EMPTY);
  const [tagText, setTagText] = useState("");
  const [busy, setBusy] = useState(false);
  const addTag = () => {
    const next = tagText.trim().replace(/^#/, "");
    if (next && !form.tags.includes(next) && form.tags.length < 20) setForm({ ...form, tags: [...form.tags, next] });
    setTagText("");
  };
  const tagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "،") { e.preventDefault(); addTag(); }
  };
  const save = async (status: "draft" | "in_review" | "published") => {
    if (!form.title.trim() || ((form.contentType ?? "text") === "text" && !form.content.trim())) { toast("عنوان و محتوای متنی مقاله الزامی است", false); return; }
    if (status !== "draft" && (form.contentType === "video" ? !form.videoMediaId : form.contentType === "audio" ? !form.audioMediaId : false)) { toast("برای ارسال یا انتشار، فایل رسانهٔ متناسب با نوع مقاله را بارگذاری کنید", false); return; }
    setBusy(true);
    try {
      const result = await api<{ id?: number }>(form.id ? `/api/admin/blog/${form.id}` : "/api/admin/blog", "POST", { ...form, status });
      toast(status === "published" ? "مقاله منتشر شد" : status === "in_review" ? "مقاله برای بازبینی ارسال شد" : "پیش‌نویس ذخیره شد");
      router.push(result.id ? `/admin/blog/${result.id}/edit` : "/admin/blog");
      router.refresh();
    } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  };
  const categoryOptions = Array.from(new Set([form.category, ...categories].filter(Boolean)));
  return <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] 2xl:gap-6">
    <div className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <div><label className="mb-1 block text-sm text-slate-600">عنوان مقاله</label><input className="input text-lg font-bold" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان روشن و جذاب مقاله" /></div>
      <div><label className="mb-1 block text-sm text-slate-600">خلاصه مقاله</label><textarea className="input min-h-24" value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="خلاصه‌ای کوتاه برای کارت مقاله و نتایج جست‌وجو" /></div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3"><label className="block text-sm font-bold text-slate-700">قالب محتوا<select className="input mt-1" value={form.contentType ?? "text"} onChange={(e) => setForm({ ...form, contentType: e.target.value })}><option value="text">مقاله متنی</option><option value="video">مقاله ویدئویی</option><option value="audio">مقاله صوتی / پادکست</option></select></label>{form.contentType === "video" && <VideoUploader value={form.videoMediaId ?? null} onChange={(videoMediaId) => setForm({ ...form, videoMediaId })} kind="video" label="ویدیوی مقاله (MP4 یا WebM)" />} {form.contentType === "audio" && <VideoUploader value={form.audioMediaId ?? null} onChange={(audioMediaId) => setForm({ ...form, audioMediaId })} kind="audio" label="فایل صوتی مقاله (MP3، WAV یا OGG)" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" />}</div>
      {(form.contentType ?? "text") === "text" ? <div className="min-w-0"><label className="mb-1 block text-sm text-slate-600">محتوای مقاله</label><ShortcodeInsert onInsert={(token) => setForm({ ...form, content: `${form.content}<p>${token}</p>` })} /><RichEditor value={form.content} onChange={(content) => setForm({ ...form, content })} placeholder="محتوای کامل، تیترها، تصاویر و جدول‌ها…" minHeight={420} /><p className="mt-1 text-xs text-slate-400">می‌توانید فهرست محصولات، ویدیو و کاروسل مقاله را در متن درج کنید.</p></div> : <div><label className="mb-1 block text-sm text-slate-600">متن همراه یا پیاده‌سازی محتوا (اختیاری)</label><RichEditor value={form.content} onChange={(content) => setForm({ ...form, content })} placeholder="خلاصه، متن همراه یا پیاده‌سازی گفتار برای دسترس‌پذیری و جست‌وجو…" minHeight={240} /></div>}
    </div>
    <aside className="order-first min-w-0 space-y-4 2xl:order-last 2xl:space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><b className="mb-4 block">انتشار و بازبینی</b><div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1"><button type="button" disabled={busy} onClick={() => save("draft")} className="btn-ghost w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}ذخیره پیش‌نویس</button>{canPublish ? <button type="button" disabled={busy} onClick={() => save("published")} className="btn-primary w-full"><Send className="h-4 w-4" />انتشار</button> : <button type="button" disabled={busy} onClick={() => save("in_review")} className="btn-primary w-full"><Send className="h-4 w-4" />ارسال برای بازبینی</button>}</div><p className="mt-3 text-xs text-slate-500">وضعیت فعلی: {form.status === "published" ? "منتشرشده" : form.status === "in_review" ? "در انتظار بازبینی" : "پیش‌نویس"}</p>{form.reviewNote && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs leading-6 text-amber-900">یادداشت بازبینی: {form.reviewNote}</p>}</div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><b className="block">مشخصات مقاله</b><input className="input" value={form.slug} dir="ltr" onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="slug-english-or-persian" /><label className="block text-xs font-bold text-slate-600">دسته‌بندی<select className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label><div><label className="block text-xs font-bold text-slate-600">برچسب‌ها</label><div className="mt-1 flex gap-2"><input className="input min-w-0" list="blog-tag-options" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={tagKey} placeholder="نام برچسب" /><button type="button" onClick={addTag} className="btn-sm shrink-0" aria-label="افزودن برچسب"><Plus className="size-4" /></button></div><datalist id="blog-tag-options">{availableTags.filter((tag) => !form.tags.includes(tag)).map((tag) => <option key={tag} value={tag} />)}</datalist><div className="mt-2 flex flex-wrap gap-1.5">{form.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><Tag className="size-3" />{tag}<button type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })} aria-label={`حذف برچسب ${tag}`}><X className="size-3" /></button></span>)}</div></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><b className="mb-3 block">تصویر شاخص</b><ImageUploader max={1} folderSlug="blog" value={form.coverImageId ? [form.coverImageId] : []} onChange={(ids) => setForm({ ...form, coverImageId: ids[0] ?? null })} /></div>
      <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5"><b className="block text-emerald-900">سئوی مقاله</b><input className="input" value={form.seoTitle ?? ""} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} placeholder="عنوان سئو" /><textarea className="input min-h-24" value={form.metaDescription ?? ""} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} placeholder="توضیحات متا" /><input className="input" dir="ltr" value={form.canonicalUrl ?? ""} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} placeholder="Canonical URL (اختیاری)" /></div>
    </aside>
  </div>;
}
