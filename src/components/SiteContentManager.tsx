"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Eye, EyeOff, FilePlus2 } from "lucide-react";
import { api, toast } from "./client";
import { ImageUploader } from "./client";
import type { SitePageBlock } from "@/db/schema";

type Page = {
  id: number; title: string; slug: string; template: string; summary: string | null;
  blocks: SitePageBlock[]; metaTitle: string | null; metaDescription: string | null; status: string;
};
type FooterLink = { id: number; groupTitle: string; label: string; href: string; sortOrder: number; enabled: boolean };
type Block = SitePageBlock;
const newBlock = (type: Block["type"] = "text"): Block => ({ type, title: "", body: "", mediaId: null, caption: "", buttonLabel: "", href: "", items: [] });
const freshPage = (): Omit<Page, "id"> => ({ title: "", slug: "", template: "nature", summary: "", blocks: [newBlock("hero")], metaTitle: "", metaDescription: "", status: "draft" });
const itemText = (items: { title: string; body: string }[] | undefined) => (items ?? []).map((x) => x.title + " | " + x.body).join("\n");
const parseItems = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
  const [title, ...rest] = line.split("|"); return { title: title.trim(), body: rest.join("|").trim() };
});

export function SiteContentManager({ initialPages, initialLinks }: { initialPages: Page[]; initialLinks: FooterLink[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [draft, setDraft] = useState<Omit<Page, "id"> & { id?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState(initialLinks);
  const [newLink, setNewLink] = useState({ groupTitle: "دسترسی سریع", label: "", href: "", sortOrder: 0 });
  const [linkBusy, setLinkBusy] = useState(false);

  const edit = (page: Page) => setDraft({ ...page, blocks: page.blocks ?? [] });
  const patchPage = <K extends keyof Omit<Page, "id">>(key: K, value: Omit<Page, "id">[K]) => setDraft((old) => old ? { ...old, [key]: value } : old);
  const patchBlock = (index: number, value: Partial<Block>) => setDraft((old) => old ? { ...old, blocks: old.blocks.map((block, i) => i === index ? { ...block, ...value } : block) } : old);
  const savePage = async () => {
    if (!draft?.title.trim() || !draft.slug.trim()) { toast("عنوان و نشانی صفحه را وارد کنید", false); return; }
    setBusy(true);
    try {
      const payload = { ...draft, blocks: draft.blocks };
      const result = await api<Page>(draft.id ? "/api/admin/site-pages/" + draft.id : "/api/admin/site-pages", "POST", payload);
      if (draft.id) setPages((old) => old.map((page) => page.id === draft.id ? { ...page, ...payload } as Page : page));
      else setPages((old) => [{ ...payload, id: result.id }, ...old] as Page[]);
      setDraft(null); router.refresh(); toast("صفحه ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const toggleLink = async (link: FooterLink) => {
    try { await api("/api/admin/footer-links/" + link.id, "POST", { ...link, enabled: !link.enabled }); setLinks((old) => old.map((x) => x.id === link.id ? { ...x, enabled: !x.enabled } : x)); toast("وضعیت پیوند ذخیره شد"); }
    catch (error) { toast((error as Error).message, false); }
  };
  const saveLink = async (link: FooterLink) => {
    try { await api("/api/admin/footer-links/" + link.id, "POST", link); toast("پیوند ذخیره شد"); }
    catch (error) { toast((error as Error).message, false); }
  };
  const createLink = async (event: React.FormEvent) => {
    event.preventDefault(); setLinkBusy(true);
    try { const row = await api<FooterLink>("/api/admin/footer-links", "POST", newLink); setLinks((old) => [...old, row]); setNewLink({ ...newLink, label: "", href: "", sortOrder: 0 }); toast("پیوند فوتر افزوده شد"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setLinkBusy(false); }
  };

  return <div className="space-y-6">
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">صفحه‌ساز سایت</h2><p className="mt-1 text-sm text-slate-500">صفحه‌های درباره ما و تماس با ما را ویرایش یا صفحه تازه‌ای با چیدمان دلخواه بسازید.</p></div><button className="btn-primary" onClick={() => setDraft(freshPage())}><FilePlus2 className="size-4"/>صفحه تازه</button></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pages.map((page) => <button key={page.id} onClick={() => edit(page)} className="rounded-xl border p-3 text-right hover:border-emerald-400 hover:bg-emerald-50/40"><span className="flex items-center justify-between gap-2"><b>{page.title}</b><span className={"rounded-full px-2 py-0.5 text-[10px] " + (page.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>{page.status === "published" ? "منتشر" : "پیش‌نویس"}</span></span><small className="mt-1 block text-slate-500" dir="ltr">{page.slug === "about" || page.slug === "contact" ? "/" + page.slug : "/pages/" + page.slug}</small></button>)}</div>
      {!pages.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">هنوز صفحه‌ای ایجاد نشده است.</p>}
    </section>

    {draft && <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">{draft.id ? "ویرایش صفحه" : "ساخت صفحه جدید"}</h2><p className="text-xs text-slate-500">از دکمه افزودن بخش برای ساخت چیدمان استفاده کنید.</p></div><a href={draft.id ? (draft.slug === "about" || draft.slug === "contact" ? "/" + draft.slug : "/pages/" + draft.slug) : "#"} target="_blank" className="btn-ghost"><Eye className="size-4"/>پیش‌نمایش</a></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">عنوان صفحه<input className="input mt-1" value={draft.title} onChange={(e) => patchPage("title", e.target.value)} /></label>
        <label className="text-sm">نشانی (Slug)<input className="input mt-1" dir="ltr" placeholder="مثلاً shipping-guide" value={draft.slug} onChange={(e) => patchPage("slug", e.target.value)} /></label>
        <label className="text-sm">طرح کلی<select className="input mt-1" value={draft.template} onChange={(e) => patchPage("template", e.target.value)}><option value="nature">طبیعت فروشگاه</option><option value="editorial">مجله‌ای</option><option value="minimal">مینیمال</option><option value="contact">تماس با ما (با اطلاعات تماس)</option></select></label>
        <label className="text-sm">وضعیت انتشار<select className="input mt-1" value={draft.status} onChange={(e) => patchPage("status", e.target.value)}><option value="draft">پیش‌نویس</option><option value="published">منتشر شود</option></select></label>
        <label className="text-sm md:col-span-2">خلاصه / توضیح کوتاه<input className="input mt-1" value={draft.summary ?? ""} onChange={(e) => patchPage("summary", e.target.value)} /></label>
        <label className="text-sm">عنوان سئو<input className="input mt-1" value={draft.metaTitle ?? ""} onChange={(e) => patchPage("metaTitle", e.target.value)} /></label>
        <label className="text-sm">توضیحات سئو<input className="input mt-1" value={draft.metaDescription ?? ""} onChange={(e) => patchPage("metaDescription", e.target.value)} /></label>
      </div>
      <div className="space-y-4">
        {draft.blocks.map((block, index) => <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><b>بخش {new Intl.NumberFormat("fa-IR").format(index + 1)}</b><div className="flex gap-1"><button type="button" disabled={index === 0} className="btn-sm" title="بالا" onClick={() => patchPage("blocks", draft.blocks.map((x, i, a) => i === index ? a[index - 1] : i === index - 1 ? a[index] : x))}><ArrowUp className="size-4"/></button><button type="button" disabled={index === draft.blocks.length - 1} className="btn-sm" title="پایین" onClick={() => patchPage("blocks", draft.blocks.map((x, i, a) => i === index ? a[index + 1] : i === index + 1 ? a[index] : x))}><ArrowDown className="size-4"/></button><button type="button" className="btn-sm text-rose-600" onClick={() => patchPage("blocks", draft.blocks.filter((_, i) => i !== index))}>حذف بخش</button></div></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">نوع بخش<select className="input mt-1" value={block.type} onChange={(e) => patchBlock(index, { ...newBlock(e.target.value as Block["type"]), title: block.title })}><option value="hero">بنر / معرفی</option><option value="text">متن و توضیح</option><option value="features">کارت‌های ویژگی</option><option value="image">تصویر</option><option value="cta">دعوت به اقدام</option><option value="faq">سؤالات متداول</option></select></label>
            <label className="text-sm">عنوان بخش<input className="input mt-1" value={block.title ?? ""} onChange={(e) => patchBlock(index, { title: e.target.value })} /></label>
            {["hero", "text", "cta"].includes(block.type) && <label className="text-sm md:col-span-2">متن بخش<textarea className="input mt-1 min-h-24" value={block.body ?? ""} onChange={(e) => patchBlock(index, { body: e.target.value })} /></label>}
            {["hero", "image"].includes(block.type) && <div className="text-sm md:col-span-2"><span className="mb-2 block">تصویر از مرکز فایل</span><ImageUploader value={block.mediaId ? [block.mediaId] : []} max={1} onChange={(ids) => patchBlock(index, { mediaId: ids[0] ?? null })}/><input className="input mt-2" placeholder="زیرنویس تصویر" value={block.caption ?? ""} onChange={(e) => patchBlock(index, { caption: e.target.value })}/></div>}
            {["features", "faq"].includes(block.type) && <label className="text-sm md:col-span-2">{block.type === "faq" ? "پرسش و پاسخ (هر ردیف: پرسش | پاسخ)" : "کارت‌ها (هر ردیف: عنوان | توضیح)"}<textarea className="input mt-1 min-h-32" value={itemText(block.items)} onChange={(e) => patchBlock(index, { items: parseItems(e.target.value) })} placeholder={"عنوان اول | توضیحات\nعنوان دوم | توضیحات"} /></label>}
            {block.type === "cta" && <><label className="text-sm">متن دکمه<input className="input mt-1" value={block.buttonLabel ?? ""} onChange={(e) => patchBlock(index, { buttonLabel: e.target.value })}/></label><label className="text-sm">نشانی دکمه<input className="input mt-1" dir="ltr" placeholder="/shop" value={block.href ?? ""} onChange={(e) => patchBlock(index, { href: e.target.value })}/></label></>}
          </div>
        </article>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2"><button type="button" className="btn-ghost" onClick={() => patchPage("blocks", [...draft.blocks, newBlock()])}><Plus className="size-4"/>افزودن بخش</button><div className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => setDraft(null)}>انصراف</button><button type="button" disabled={busy} className="btn-primary" onClick={savePage}><Save className="size-4"/>{busy ? "در حال ذخیره…" : "ذخیره صفحه"}</button></div></div>
    </section>}

    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4"><h2 className="text-xl font-black">منوهای فوتر</h2><p className="mt-1 text-sm text-slate-500">عنوان ستون، متن پیوند، نشانی و ترتیب نمایش را ویرایش کنید.</p></div>
      <div className="space-y-3">{links.map((link) => <FooterLinkRow key={link.id} link={link} onSave={saveLink} onToggle={toggleLink} onChange={(updated) => setLinks((old) => old.map((x) => x.id === link.id ? updated : x))}/>)}</div>
      <form onSubmit={createLink} className="mt-5 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_1fr_2fr_100px_auto]">
        <input className="input" placeholder="عنوان ستون" value={newLink.groupTitle} onChange={(e) => setNewLink({ ...newLink, groupTitle: e.target.value })} required/>
        <input className="input" placeholder="متن پیوند" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} required/>
        <input className="input" dir="ltr" placeholder="/pages/shipping" value={newLink.href} onChange={(e) => setNewLink({ ...newLink, href: e.target.value })} required/>
        <input className="input" type="number" placeholder="ترتیب" value={newLink.sortOrder} onChange={(e) => setNewLink({ ...newLink, sortOrder: Number(e.target.value) })}/>
        <button disabled={linkBusy} className="btn-primary"><Plus className="size-4"/>افزودن</button>
      </form>
    </section>
  </div>;
}

function FooterLinkRow({ link, onChange, onSave, onToggle }: { link: FooterLink; onChange: (link: FooterLink) => void; onSave: (link: FooterLink) => void; onToggle: (link: FooterLink) => void }) {
  return <div className={"grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_2fr_90px_auto_auto] " + (!link.enabled ? "opacity-50" : "")}>
    <input className="input" aria-label="عنوان ستون فوتر" value={link.groupTitle} onChange={(e) => onChange({ ...link, groupTitle: e.target.value })}/>
    <input className="input" aria-label="متن پیوند" value={link.label} onChange={(e) => onChange({ ...link, label: e.target.value })}/>
    <input className="input" aria-label="نشانی پیوند" dir="ltr" value={link.href} onChange={(e) => onChange({ ...link, href: e.target.value })}/>
    <input className="input" aria-label="ترتیب نمایش" type="number" value={link.sortOrder} onChange={(e) => onChange({ ...link, sortOrder: Number(e.target.value) })}/>
    <button type="button" className="btn-sm" onClick={() => onSave(link)}><Save className="size-4"/>ذخیره</button>
    <button type="button" className="btn-sm" onClick={() => onToggle(link)}>{link.enabled ? <><EyeOff className="size-4"/>پنهان</> : <><Eye className="size-4"/>نمایش</>}</button>
  </div>;
}
