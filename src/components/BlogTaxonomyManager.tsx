"use client";
import { useState, type FormEvent } from "react";
import { FolderTree, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { api, toast } from "./client";
import { Card, Empty } from "./ui";

type Category = { id: number; name: string; slug: string; description: string | null; sortOrder: number; isActive: boolean };
type Tag = { id: number; name: string; slug: string; seoTitle: string | null; metaDescription: string | null; seoKeywords: string | null; canonicalUrl: string | null; persisted?: boolean };

export default function BlogTaxonomyManager({ initialCategories, initialTags }: { initialCategories: Category[]; initialTags: Tag[] }) {
  const [categories, setCategories] = useState(initialCategories), [tags, setTags] = useState(initialTags);
  const [category, setCategory] = useState<Partial<Category>>({ name: "", slug: "", description: "", sortOrder: 0, isActive: true });
  const [tag, setTag] = useState<Partial<Tag>>({ name: "", slug: "", seoTitle: "", metaDescription: "", seoKeywords: "", canonicalUrl: "" });
  const [busy, setBusy] = useState(false);
  const saveCategory = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { const url = category.id ? `/api/admin/blog/categories/${category.id}` : "/api/admin/blog/categories"; await api(url, "POST", category); toast(category.id ? "دسته ویرایش شد" : "دسته افزوده شد"); location.reload(); } catch (error) { toast((error as Error).message, false); } finally { setBusy(false); } };
  const saveTag = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { const updating = !!tag.id && tag.persisted !== false; const url = updating ? `/api/admin/blog/tags/${tag.id}` : "/api/admin/blog/tags"; await api(url, "POST", tag); toast(updating ? "برچسب ویرایش شد" : "برچسب افزوده شد"); location.reload(); } catch (error) { toast((error as Error).message, false); } finally { setBusy(false); } };
  const remove = async (kind: "categories" | "tags", id: number, name: string) => { if (!confirm(`«${name}» حذف شود؟`)) return; try { await api(`/api/admin/blog/${kind}/${id}`, "POST", { delete: true }); if (kind === "categories") setCategories((list) => list.filter((x) => x.id !== id)); else setTags((list) => list.filter((x) => x.id !== id)); toast("حذف شد"); } catch (error) { toast((error as Error).message, false); } };
  return <div className="grid items-start gap-5 xl:grid-cols-2">
    <Card title={<span className="inline-flex items-center gap-2"><FolderTree className="size-5 text-emerald-700" />دسته‌بندی مقاله‌ها</span>}>
      <form onSubmit={saveCategory} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
        <input required className="input" value={category.name ?? ""} onChange={(e) => setCategory({ ...category, name: e.target.value })} placeholder="نام دسته" />
        <input className="input" dir="ltr" value={category.slug ?? ""} onChange={(e) => setCategory({ ...category, slug: e.target.value })} placeholder="slug (اختیاری)" />
        <textarea className="input min-h-20 sm:col-span-2" value={category.description ?? ""} onChange={(e) => setCategory({ ...category, description: e.target.value })} placeholder="توضیح کوتاه دسته" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={category.isActive !== false} onChange={(e) => setCategory({ ...category, isActive: e.target.checked })} />فعال</label>
        <div className="flex justify-end gap-2"><button disabled={busy} className="btn-primary"><Plus className="size-4" />{category.id ? "ذخیره" : "افزودن"}</button>{category.id && <button type="button" className="btn-ghost" onClick={() => setCategory({ name: "", slug: "", description: "", sortOrder: 0, isActive: true })}><X className="size-4" /></button>}</div>
      </form>
      <div className="mt-4 space-y-2">{categories.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><b className="text-sm">{item.name}</b><span className="mr-2 text-xs text-slate-400" dir="ltr">/{item.slug}</span>{item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}</div><div className="flex gap-1"><button className="btn-sm" onClick={() => setCategory(item)}><Pencil className="size-3.5" />ویرایش</button><button className="btn-sm text-rose-600" onClick={() => remove("categories", item.id, item.name)}><Trash2 className="size-3.5" /></button></div></div>)}{!categories.length && <Empty title="دسته‌ای ثبت نشده است" />}</div>
    </Card>
    <Card title={<span className="inline-flex items-center gap-2"><Tags className="size-5 text-emerald-700" />برچسب‌های مقاله</span>}>
      <form onSubmit={saveTag} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
        <input required className="input" value={tag.name ?? ""} onChange={(e) => setTag({ ...tag, name: e.target.value })} placeholder="نام برچسب" />
        <input className="input" dir="ltr" value={tag.slug ?? ""} onChange={(e) => setTag({ ...tag, slug: e.target.value })} placeholder="slug (اختیاری)" />
        <p className="text-xs leading-6 text-slate-500 sm:col-span-2">برای آرشیو عمومی برچسب، عنوان و توضیحات سئو را اختصاصی وارد کنید؛ در صورت خالی‌بودن، از نام و مقاله‌های منتشرشده استفاده می‌شود.</p>
        <input className="input" value={tag.seoTitle ?? ""} onChange={(e) => setTag({ ...tag, seoTitle: e.target.value })} placeholder="عنوان SEO آرشیو" />
        <input className="input" value={tag.seoKeywords ?? ""} onChange={(e) => setTag({ ...tag, seoKeywords: e.target.value })} placeholder="کلمات کلیدی، جداشده با ویرگول" />
        <textarea className="input min-h-20 sm:col-span-2" value={tag.metaDescription ?? ""} onChange={(e) => setTag({ ...tag, metaDescription: e.target.value })} placeholder="توضیحات متای آرشیو برچسب" />
        <input className="input sm:col-span-2" dir="ltr" type="url" value={tag.canonicalUrl ?? ""} onChange={(e) => setTag({ ...tag, canonicalUrl: e.target.value })} placeholder="Canonical سفارشی (اختیاری، URL کامل)" />
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="btn-primary"><Plus className="size-4" />{tag.id ? "ذخیره" : "افزودن"}</button>{tag.id && <button type="button" className="btn-ghost" onClick={() => setTag({ name: "", slug: "", seoTitle: "", metaDescription: "", seoKeywords: "", canonicalUrl: "" })}><X className="size-4" /></button>}</div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">{tags.map((item) => <span key={item.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs"><button onClick={() => setTag(item)} className="font-bold text-slate-700">#{item.name}</button>{item.persisted !== false && <button aria-label={`حذف ${item.name}`} onClick={() => remove("tags", item.id, item.name)} className="text-rose-500"><Trash2 className="size-3" /></button>}{item.persisted === false && <span className="text-slate-400">· تنظیم سئو</span>}</span>)}</div>{!tags.length && <div className="mt-4"><Empty title="برچسبی ثبت نشده است" /></div>}
    </Card>
  </div>;
}
