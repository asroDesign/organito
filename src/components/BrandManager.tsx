"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ExternalLink, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { api, ImageUploader, toast } from "./client";
import { Modal } from "./Modal";
import { Badge, Img } from "./ui";

type BlogOption = { id: number; title: string; slug: string };
type Brand = { id: number; name: string; slug: string; logoMediaId: number | null; bannerMediaId: number | null; description: string | null; seoTitle: string | null; metaDescription: string | null; seoKeywords: string[]; canonicalUrl: string | null; relatedBlogPostIds: number[]; isActive: boolean; sortOrder: number; productCount: number };
type Draft = Omit<Brand, "id" | "productCount">;
const empty = (): Draft => ({ name: "", slug: "", logoMediaId: null, bannerMediaId: null, description: "", seoTitle: "", metaDescription: "", seoKeywords: [], canonicalUrl: "", relatedBlogPostIds: [], isActive: true, sortOrder: 0 });

export function BrandManager({ initial, posts }: { initial: Brand[]; posts: BlogOption[] }) {
  const [rows, setRows] = useState(initial), [draft, setDraft] = useState<Draft>(empty()), [editing, setEditing] = useState<number | null>(null), [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false);
  const filtered = useMemo(() => rows.filter((b) => `${b.name} ${b.slug}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [rows, query]);
  const start = (brand?: Brand) => {
    setEditing(brand?.id ?? null);
    setOpen(true);
    setDraft(brand ? { name: brand.name, slug: brand.slug, logoMediaId: brand.logoMediaId, bannerMediaId: brand.bannerMediaId, description: brand.description ?? "", seoTitle: brand.seoTitle ?? "", metaDescription: brand.metaDescription ?? "", seoKeywords: brand.seoKeywords ?? [], canonicalUrl: brand.canonicalUrl ?? "", relatedBlogPostIds: brand.relatedBlogPostIds ?? [], isActive: brand.isActive, sortOrder: brand.sortOrder } : empty());
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { ...draft, seoKeywords: draft.seoKeywords.join("،") };
      const row = await api<Brand>(editing ? `/api/admin/brands/${editing}` : "/api/admin/brands", editing ? "PUT" : "POST", payload);
      const productCount = rows.find((x) => x.id === row.id)?.productCount ?? 0;
      setRows((old) => editing ? old.map((x) => x.id === row.id ? { ...row, productCount } : x) : [{ ...row, productCount }, ...old]);
      setEditing(null); setOpen(false); toast("اطلاعات برند ذخیره شد");
    } catch (e) { toast(e instanceof Error ? e.message : "ذخیره برند انجام نشد", false); } finally { setBusy(false); }
  };
  const archive = async (brand: Brand) => {
    if (!window.confirm(`برند «${brand.name}» از صفحات عمومی بایگانی شود؟`)) return;
    try { await api(`/api/admin/brands/${brand.id}`, "DELETE", {}); setRows((old) => old.map((x) => x.id === brand.id ? { ...x, isActive: false } : x)); toast("برند بایگانی شد"); }
    catch (e) { toast((e as Error).message, false); }
  };
  const moveToTrash = async (brand: Brand) => {
    if (!window.confirm(`برند «${brand.name}» به زباله منتقل شود؟ هر زمان می‌توانید آن را بازیابی کنید.`)) return;
    try { await api(`/api/admin/brands/${brand.id}/trash`, "POST", {}); setRows((old) => old.filter((x) => x.id !== brand.id)); toast("برند به زباله منتقل شد."); }
    catch (e) { toast((e as Error).message, false); }
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((old) => ({ ...old, [key]: value }));

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-56 flex-1 sm:max-w-sm"><Search className="absolute right-3 top-2.5 size-4 text-slate-400"/><input className="input pr-9" placeholder="جست‌وجوی نام برند" value={query} onChange={(e) => setQuery(e.target.value)}/></div><button onClick={() => start()} className="btn-primary"><Plus className="size-4"/>افزودن برند</button></div>
    {filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((brand) => <article key={brand.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-28 bg-gradient-to-l from-emerald-950 to-emerald-700">{brand.bannerMediaId && <Img id={brand.bannerMediaId} alt="" className="h-full w-full opacity-65"/>}<div className="absolute -bottom-7 right-4 grid size-16 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow">{brand.logoMediaId ? <Img id={brand.logoMediaId} alt={brand.name} className="size-full"/> : <Tags className="size-7 text-emerald-700"/>}</div><span className="absolute left-3 top-3"><Badge tone={brand.isActive ? "green" : "gray"}>{brand.isActive ? "فعال" : "بایگانی"}</Badge></span></div>
      <div className="p-4 pt-10"><h2 className="font-black text-slate-900">{brand.name}</h2><p dir="ltr" className="mt-1 truncate text-xs text-slate-400">/brands/{brand.slug}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span>{brand.productCount.toLocaleString("fa-IR")} محصول</span><span>·</span><span>{brand.relatedBlogPostIds.length.toLocaleString("fa-IR")} مقاله مرتبط</span></div>{brand.seoTitle && <p className="mt-3 truncate rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{brand.seoTitle}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={() => start(brand)} className="btn-sm"><Pencil className="size-3.5"/>ویرایش</button>{brand.isActive && <Link href={`/brands/${brand.slug}`} target="_blank" className="btn-sm"><ExternalLink className="size-3.5"/>مشاهده صفحه</Link>}{brand.isActive && <button onClick={() => void archive(brand)} className="btn-sm"><Trash2 className="size-3.5"/>بایگانی</button>}<button onClick={() => void moveToTrash(brand)} className="btn-sm text-rose-600"><Trash2 className="size-3.5"/>انتقال به زباله</button></div></div>
    </article>)}</div> : <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">برندی با این مشخصات پیدا نشد.</div>}
    {open ? <Modal title={editing ? "ویرایش برند" : "برند جدید"} onClose={() => setOpen(false)} wide><form onSubmit={save} className="space-y-5">
      <section className="grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-2"><label className="text-sm font-bold">نام برند<input required minLength={2} maxLength={100} className="input mt-1" value={draft.name} onChange={(e) => set("name", e.target.value)}/></label><label className="text-sm font-bold">نشانی صفحه (slug)<input dir="ltr" className="input mt-1 text-left" placeholder="در صورت خالی بودن از نام ساخته می‌شود" value={draft.slug} onChange={(e) => set("slug", e.target.value)}/></label><label className="text-sm font-bold md:col-span-2">معرفی برند<textarea rows={4} maxLength={15000} className="input mt-1 leading-7" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-emerald-700"/>صفحه برند فعال و قابل ایندکس باشد</label><label className="text-sm">ترتیب نمایش<input type="number" min={0} max={10000} className="input mt-1" value={draft.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}/></label></section>
      <section className="grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-2"><div><b className="mb-2 block text-sm">لوگوی برند</b><ImageUploader value={draft.logoMediaId ? [draft.logoMediaId] : []} max={1} onChange={(ids) => set("logoMediaId", ids[0] ?? null)}/></div><div><b className="mb-2 block text-sm">بنر صفحه برند</b><ImageUploader value={draft.bannerMediaId ? [draft.bannerMediaId] : []} max={1} onChange={(ids) => set("bannerMediaId", ids[0] ?? null)}/></div></section>
      <section className="space-y-3 rounded-2xl border bg-white p-4"><div><h3 className="font-black">سئوی صفحه برند</h3><p className="mt-1 text-xs text-slate-500">این عنوان، توضیحات، کلیدواژه‌ها و تصویر اشتراک‌گذاری برای صفحه عمومی استفاده می‌شوند.</p></div><label className="block text-sm">عنوان SEO<input maxLength={120} className="input mt-1" value={draft.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)}/></label><label className="block text-sm">توضیحات متا<textarea maxLength={300} rows={2} className="input mt-1" value={draft.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)}/></label><label className="block text-sm">کلمات کلیدی<input className="input mt-1" value={(draft.seoKeywords ?? []).join("، ")} onChange={(e) => set("seoKeywords", e.target.value.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean))}/></label><label className="block text-sm">Canonical اختیاری<input dir="ltr" type="url" className="input mt-1 text-left" value={draft.canonicalUrl ?? ""} onChange={(e) => set("canonicalUrl", e.target.value)}/></label></section>
      <section className="rounded-2xl border bg-white p-4"><h3 className="font-black">مقالات مرتبط</h3><p className="mb-3 mt-1 text-xs text-slate-500">فقط مقالات منتشرشده در صفحه برند نمایش داده می‌شوند.</p>{posts.length ? <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{posts.map((post) => <label key={post.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5"><input type="checkbox" checked={draft.relatedBlogPostIds.includes(post.id)} onChange={(e) => set("relatedBlogPostIds", e.target.checked ? [...draft.relatedBlogPostIds, post.id].slice(0, 20) : draft.relatedBlogPostIds.filter((id) => id !== post.id))} className="mt-1 accent-emerald-700"/><span>{post.title}</span></label>)}</div> : <p className="text-xs text-slate-500">مقاله منتشرشده‌ای برای اتصال وجود ندارد.</p>}</section>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="btn-ghost">انصراف</button><button disabled={busy} className="btn-primary"><BadgeCheck className="size-4"/>{busy ? "در حال ذخیره…" : "ذخیره برند"}</button></div>
    </form></Modal> : null}
  </div>;
}
