"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Eye, EyeOff, FilePlus2, Trash2, History, X, LayoutTemplate } from "lucide-react";
import { api, toast } from "./client";
import { ImageUploader } from "./client";
import Link from "next/link";
import type { SitePageBlock, SitePageBlockItem } from "@/db/schema";
import { createHomeTemplateBlocks, DEFAULT_HOME_LAYOUT } from "@/lib/home-page-builder";
import { SiteBlockContent } from "./SiteBlockContent";
import { PageBlockFrame } from "./PageBlockFrame";
import { ShortcodeInsert } from "./ShortcodeInsert";
import { builderId, createBlock } from "@/lib/page-builder";

type Page = {
  id: number; title: string; slug: string; template: string; summary: string | null;
  blocks: SitePageBlock[]; metaTitle: string | null; metaDescription: string | null; status: string;
};
type FooterLink = { id: number; groupTitle: string; label: string; href: string; sortOrder: number; enabled: boolean };
type FormOption = { id: number; title: string; slug: string; status: string };
type Block = SitePageBlock;
const newBlock = (type: Block["type"] = "text"): Block => ({ id: builderId(), type, title: "", body: "", mediaId: null, caption: "", buttonLabel: "", href: "", items: [], columns: type === "columns" ? [{ id: builderId(), blocks: [newBlock("text")] }, { id: builderId(), blocks: [newBlock("text")] }] : [] });
const newItem = (kind: SitePageBlockItem["kind"] = "text"): SitePageBlockItem => ({ kind, title: "", body: "", mediaId: null, caption: "", buttonLabel: "", href: "" });
const freshPage = (): Omit<Page, "id"> => ({ title: "", slug: "", template: "nature", summary: "", blocks: [newBlock("hero")], metaTitle: "", metaDescription: "", status: "draft" });
const itemText = (items: { title: string; body: string }[] | undefined) => (items ?? []).map((x) => x.title + " | " + x.body).join("\n");
const parseItems = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
  const [title, ...rest] = line.split("|"); return { title: title.trim(), body: rest.join("|").trim() };
});
const pagePresets: Record<string, { label: string; template: string; blocks: () => Block[] }> = {
  story: { label: "معرفی برند ارگانیک", template: "nature", blocks: () => [
    { ...newBlock("hero"), title: "داستان ما؛ از خاک سالم تا سفره شما", body: "با انتخاب محصولات سالم و مسئولانه، کیفیت زندگی را در کنار طبیعت حفظ می‌کنیم.", buttonLabel: "مشاهده محصولات", href: "/shop", options: { badge: "طبیعی، سالم و قابل اعتماد" } },
    { ...newBlock("text"), title: "تعهد ما به کیفیت", body: "هر محصول با دقت انتخاب می‌شود تا مسیر تولید تا مصرف شفاف و قابل اعتماد باشد." },
    { ...newBlock("features"), title: "چرا از ما خرید کنید؟", items: [{ ...newItem(), title: "انتخاب مسئولانه", body: "محصولات منتخب از تولیدکنندگان قابل اعتماد." }, { ...newItem(), title: "تازگی و کیفیت", body: "توجه به کیفیت در تمام مراحل نگهداری و ارسال." }, { ...newItem(), title: "پشتیبانی همراه", body: "پاسخ‌گویی در کنار شما برای خریدی مطمئن." }] },
    { ...newBlock("cta"), title: "طعم انتخاب سالم را تجربه کنید", body: "محصول مورد نیازتان را از فروشگاه ببینید.", buttonLabel: "رفتن به فروشگاه", href: "/shop" },
  ] },
  guide: { label: "راهنمای پرسش‌های متداول", template: "editorial", blocks: () => [
    { ...newBlock("hero"), title: "راهنمای خرید و نگهداری", body: "پاسخ پرسش‌های رایج درباره انتخاب، سفارش و نگهداری محصولات.", options: { badge: "راهنمای مشتریان" } },
    { ...newBlock("text"), title: "پیش از خرید بدانید", body: "اطلاعات محصول و شرایط ارسال را بررسی کنید؛ تیم پشتیبانی برای راهنمایی بیشتر در دسترس است." },
    { ...newBlock("faq"), title: "پرسش‌های متداول", items: [{ ...newItem(), title: "چطور سفارش خود را ثبت کنم؟", body: "محصول را به سبد خرید اضافه کنید و مراحل تسویه را تکمیل کنید." }, { ...newItem(), title: "چطور سفارش را پیگیری کنم؟", body: "از بخش سفارش‌های من می‌توانید وضعیت سفارش را مشاهده کنید." }] },
    { ...newBlock("cta"), title: "هنوز پرسشی دارید؟", buttonLabel: "تماس با پشتیبانی", href: "/contact" },
  ] },
  editorial: { label: "مقاله و محتوای تصویری", template: "editorial", blocks: () => [
    { ...newBlock("hero"), title: "عنوان محتوای شما", body: "یک مقدمه کوتاه و روشن برای معرفی موضوع این صفحه بنویسید.", options: { badge: "مجله سبزینه" } },
    { ...newBlock("image"), title: "تصویر شاخص", caption: "توضیح کوتاه تصویر" },
    { ...newBlock("text"), title: "بخش نخست", body: "متن اصلی صفحه را در این بخش وارد کنید. برای خوانایی بهتر، هر بخش را به یک موضوع مشخص اختصاص دهید." },
    { ...newBlock("grid"), title: "بخش‌های مرتبط", items: [{ ...newItem("cta"), title: "مطالب بیشتر", body: "محتوای مرتبط را معرفی کنید.", buttonLabel: "مطالعه بیشتر", href: "/blog" }] },
  ] },
  contact: { label: "تماس و پشتیبانی", template: "contact", blocks: () => [
    { ...newBlock("hero"), title: "در کنار شما هستیم", body: "برای دریافت راهنمایی درباره محصولات، ثبت یا پیگیری سفارش، با تیم پشتیبانی ما در ارتباط باشید.", options: { badge: "پشتیبانی مشتریان" } },
    { ...newBlock("text"), title: "چطور می‌توانیم کمک کنیم؟", body: "سوال خود را از طریق تلفن یا تیکت برای ما بفرستید. برای پیگیری سریع‌تر، شماره سفارش را در پیام خود بنویسید." },
    { ...newBlock("features"), title: "چطور سریع‌تر پاسخ بگیرید؟", items: [{ ...newItem(), title: "پیگیری سفارش", body: "شماره سفارش را در پیام خود بنویسید تا درخواست شما سریع‌تر بررسی شود." }, { ...newItem(), title: "ثبت تیکت", body: "درخواست شما به واحد مرتبط ارجاع می‌شود و پاسخ در پنل کاربری در دسترس است." }, { ...newItem(), title: "پیش از خرید", body: "راهنمای خرید و پرسش‌های متداول می‌توانند پاسخ بسیاری از سوال‌ها را در اختیار شما بگذارند." }] },
    { ...newBlock("cta"), title: "پاسخ پرسش‌های پرتکرار را ببینید", body: "شاید پاسخ مورد نظرتان در راهنمای خرید آماده باشد.", buttonLabel: "رفتن به پرسش‌های متداول", href: "/faq" },
  ] },
  about: { label: "درباره ما", template: "nature", blocks: () => [
    { ...newBlock("hero"), title: "از دل طبیعت، برای سفره‌ای سالم‌تر", body: "ما مسیر دسترسی به محصولات سالم و ارگانیک را کوتاه‌تر کرده‌ایم؛ با انتخابی آگاهانه، اطلاعات روشن و همراهی از زمان خرید تا تحویل.", buttonLabel: "دیدن محصولات", href: "/shop", options: { badge: "داستان ما" } },
    { ...newBlock("text"), title: "باور ما؛ کیفیت باید قابل اعتماد باشد", body: "هر انتخاب غذایی، فرصتی برای مراقبت از خود و زمین است. در این فروشگاه تلاش می‌کنیم محصولات تولیدکنندگان و تأمین‌کنندگان را با اطلاعات روشن معرفی کنیم تا با خیال آسوده‌تر انتخاب کنید." },
    { ...newBlock("features"), title: "چه چیزی ما را همراه شما می‌کند؟", items: [{ ...newItem(), title: "انتخاب با آگاهی", body: "مشخصات و اطلاعات محصول را پیش از خرید بررسی کنید." }, { ...newItem(), title: "همراهی تولیدکنندگان", body: "محصولات از مسیر تولیدکنندگان و تأمین‌کنندگان منتخب به دست شما می‌رسند." }, { ...newItem(), title: "پشتیبانی پاسخ‌گو", body: "در مراحل انتخاب، سفارش و پیگیری در کنار شما هستیم." }] },
    { ...newBlock("cta"), title: "انتخاب سالم را شروع کنید", body: "محصولات فروشگاه را ببینید و گزینه مناسب خود را پیدا کنید.", buttonLabel: "ورود به فروشگاه", href: "/shop" },
  ] },
  terms: { label: "شرایط استفاده", template: "editorial", blocks: () => [
    { ...newBlock("hero"), title: "شرایط استفاده از وب‌سایت", body: "این صفحه چارچوب استفاده از خدمات فروشگاه و ثبت سفارش را توضیح می‌دهد. متن را متناسب با سیاست‌های کسب‌وکار خود بازبینی و تکمیل کنید.", options: { badge: "راهنمای حقوقی" } },
    { ...newBlock("text"), title: "استفاده از خدمات", body: "با استفاده از وب‌سایت، متعهد می‌شوید اطلاعات صحیح و به‌روز وارد کنید و از خدمات در چهارچوب قوانین جاری استفاده نمایید. ایجاد حساب کاربری با شماره تلفن متعلق به شما انجام می‌شود و مسئولیت نگهداری اطلاعات ورود بر عهده شماست." },
    { ...newBlock("text"), title: "ثبت سفارش و پرداخت", body: "ثبت سفارش پس از انتخاب محصول و تکمیل مراحل سبد خرید انجام می‌شود. موجودی، قیمت و زمان آماده‌سازی ممکن است با توجه به نوع محصول و تأمین‌کننده متفاوت باشد؛ اطلاعات نهایی پیش از پرداخت به شما نمایش داده می‌شود." },
    { ...newBlock("text"), title: "ارسال، مرجوعی و پشتیبانی", body: "روش و زمان ارسال بر اساس نشانی و گزینه‌های قابل انتخاب در زمان ثبت سفارش تعیین می‌شود. درخواست‌های پیگیری یا مرجوعی از مسیرهای اعلام‌شده در پنل کاربری و صفحه تماس با ما بررسی می‌شوند." },
    { ...newBlock("text"), title: "حریم خصوصی و تغییر شرایط", body: "اطلاعات کاربران برای ارائه خدمات، پردازش سفارش و پشتیبانی استفاده می‌شود. فروشگاه می‌تواند این شرایط را به‌روزرسانی کند؛ نسخه جاری در همین صفحه منتشر خواهد شد." },
    { ...newBlock("cta"), title: "برای پرسش درباره این شرایط با ما تماس بگیرید", buttonLabel: "تماس با پشتیبانی", href: "/contact" },
  ] },
};

export function SiteContentManager({ initialPages, initialLinks, initialForms }: { initialPages: Page[]; initialLinks: FooterLink[]; initialForms: FormOption[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [draft, setDraft] = useState<Omit<Page, "id"> & { id?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState(initialLinks);
  const [newLink, setNewLink] = useState({ groupTitle: "دسترسی سریع", label: "", href: "", sortOrder: 0 });
  const [linkBusy, setLinkBusy] = useState(false);
  const [newBlockType, setNewBlockType] = useState<Block["type"]>("text");
  const [nestedBlockType, setNestedBlockType] = useState<Block["type"]>("text");
  const [selectedPreset, setSelectedPreset] = useState("story");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<{ id: number; document: Omit<Page, "id">; createdAt: string }[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const visiblePages = [
    ...pages,
    ...(["about", "contact", "terms"] as const).filter((slug) => !pages.some((page) => page.slug === slug)).map((slug) => ({
      id: -(["about", "contact", "terms"].indexOf(slug) + 1),
      title: pagePresets[slug].label,
      slug,
      template: pagePresets[slug].template,
      summary: null,
      blocks: [],
      metaTitle: pagePresets[slug].label,
      metaDescription: null,
      status: "demo",
    })),
  ].sort((a, b) => (["about", "contact", "terms"].indexOf(a.slug) - ["about", "contact", "terms"].indexOf(b.slug)) || a.title.localeCompare(b.title, "fa"));

  const edit = (page: Page) => { setSelectedPreset(page.slug in pagePresets ? page.slug : page.slug === "contact" ? "contact" : "story"); setDraft({ ...page, blocks: page.blocks ?? [] }); };
  const createPresetPage = (key: "about" | "contact" | "terms") => {
    const preset = pagePresets[key];
    const title = key === "about" ? "درباره ما" : key === "contact" ? "تماس با ما" : "شرایط استفاده";
    setSelectedPreset(key);
    setDraft({ title, slug: key, template: preset.template, summary: "", blocks: preset.blocks(), metaTitle: title, metaDescription: "اطلاعات و راهنمای " + title, status: "published" });
  };
  const createFromHomeDesign = () => setDraft({
    title: "صفحه تازه",
    slug: `page-${Date.now()}`,
    template: "nature",
    summary: "",
    blocks: createHomeTemplateBlocks(DEFAULT_HOME_LAYOUT),
    metaTitle: "",
    metaDescription: "",
    status: "draft",
  });
  const patchPage = <K extends keyof Omit<Page, "id">>(key: K, value: Omit<Page, "id">[K]) => setDraft((old) => old ? { ...old, [key]: value } : old);
  const applyPreset = () => {
    if (!draft) return;
    if (draft.blocks.length && !window.confirm("بلوک‌های فعلی پیش‌نویس با الگوی انتخاب‌شده جایگزین شوند؟ تا وقتی ذخیره نکنید، صفحهٔ منتشرشده تغییر نمی‌کند.")) return;
    const preset = pagePresets[selectedPreset];
    patchPage("template", preset.template); patchPage("blocks", preset.blocks());
  };
  const openHistory = async () => {
    if (!draft?.id) return;
    setHistoryBusy(true); setHistoryOpen(true);
    try { const rows = await api<typeof revisions>(`/api/admin/site-pages/${draft.id}/revisions`); setRevisions(rows); }
    catch (error) { toast((error as Error).message, false); setHistoryOpen(false); }
    finally { setHistoryBusy(false); }
  };
  const restoreRevision = async (revisionId: number) => {
    if (!draft?.id || !window.confirm("این نسخه در ویرایشگر بازیابی شود؟ صفحه به حالت پیش‌نویس می‌رود و تا ذخیره/انتشار تغییری در سایت عمومی نمی‌کند.")) return;
    setBusy(true);
    try { const restored = await api<Page>(`/api/admin/site-pages/${draft.id}/restore/${revisionId}`, "POST", {}); setDraft(restored); setPages((old) => old.map((page) => page.id === restored.id ? { ...page, ...restored } : page)); setHistoryOpen(false); toast("نسخه در حالت پیش‌نویس بازیابی شد"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const patchBlock = (index: number, value: Partial<Block>) => setDraft((old) => old ? { ...old, blocks: old.blocks.map((block, i) => i === index ? { ...block, ...value } : block) } : old);
  const patchStyle = (index: number, value: Partial<NonNullable<Block["style"]>>) => setDraft((old) => old ? { ...old, blocks: old.blocks.map((block, i) => i === index ? { ...block, style: { ...block.style, ...value } } : block) } : old);
  const patchItems = (blockIndex: number, items: SitePageBlockItem[]) => patchBlock(blockIndex, { items });
  const patchItem = (blockIndex: number, itemIndex: number, value: Partial<SitePageBlockItem>) => setDraft((old) => old ? { ...old, blocks: old.blocks.map((block, i) => i === blockIndex ? { ...block, items: (block.items ?? []).map((item, j) => j === itemIndex ? { ...item, ...value } : item) } : block) } : old);
  const patchColumn = (blockIndex: number, columnIndex: number, value: Partial<NonNullable<Block["columns"]>[number]>) => setDraft((old) => old ? { ...old, blocks: old.blocks.map((block, i) => i === blockIndex ? { ...block, columns: (block.columns ?? []).map((column, j) => j === columnIndex ? { ...column, ...value } : column) } : block) } : old);
  const patchNestedBlock = (blockIndex: number, columnIndex: number, childIndex: number, value: Partial<Block>) => setDraft((old) => old ? { ...old, blocks: old.blocks.map((block, i) => i === blockIndex ? { ...block, columns: (block.columns ?? []).map((column, j) => j === columnIndex ? { ...column, blocks: column.blocks.map((child, k) => k === childIndex ? { ...child, ...value } : child) } : column) } : block) } : old);
  const savePage = async () => {
    if (!draft?.title.trim()) { toast("عنوان صفحه را وارد کنید", false); return; }
    setBusy(true);
    try {
      const payload = { ...draft, blocks: draft.blocks };
      const result = await api<Page>(draft.id ? "/api/admin/site-pages/" + draft.id : "/api/admin/site-pages", "POST", payload);
      if (draft.id) setPages((old) => old.map((page) => page.id === draft.id ? { ...page, ...result } as Page : page));
      else setPages((old) => [result, ...old]);
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
  const trashPage = async (page: Page) => {
    if (["home", "about", "contact", "terms"].includes(page.slug)) return;
    if (!window.confirm(`صفحه «${page.title}» به زباله منتقل شود؟ امکان بازیابی دارد.`)) return;
    try {
      await api("/api/admin/site-pages/" + page.id, "POST", { delete: true });
      setPages((old) => old.filter((item) => item.id !== page.id));
      if (draft?.id === page.id) setDraft(null);
      toast("صفحه به زباله منتقل شد.");
    } catch (error) { toast((error as Error).message, false); }
  };
  const createLink = async (event: React.FormEvent) => {
    event.preventDefault(); setLinkBusy(true);
    try { const row = await api<FooterLink>("/api/admin/footer-links", "POST", newLink); setLinks((old) => [...old, row]); setNewLink({ ...newLink, label: "", href: "", sortOrder: 0 }); toast("پیوند فوتر افزوده شد"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setLinkBusy(false); }
  };

  return <div className="site-content-manager space-y-6">
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">مدیریت صفحات سایت</h2><p className="mt-1 text-sm text-slate-500">صفحات درباره ما، تماس با ما و صفحه‌های محتوایی را ویرایش کنید.</p></div><div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={createFromHomeDesign}><FilePlus2 className="size-4"/>صفحه تازه از طرح آماده</button><button className="btn-primary" onClick={() => setDraft(freshPage())}><FilePlus2 className="size-4"/>صفحه خالی</button></div></div>
      <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-6 text-amber-950">صفحه‌های استاندارد حتی پیش از ذخیره به‌صورت دمو در فهرست هستند؛ با انتخاب هرکدام می‌توانید طراحی را ویرایش و ذخیره کنید.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{visiblePages.map((page) => <article key={page.id} className="rounded-xl border p-3 hover:border-emerald-300"><button onClick={() => page.id < 0 ? createPresetPage(page.slug as "about" | "contact" | "terms") : edit(page)} className="w-full text-right"><span className="flex items-center justify-between gap-2"><b>{page.title}</b><span className={"rounded-full px-2 py-0.5 text-[10px] " + (page.status === "published" ? "bg-emerald-100 text-emerald-800" : page.status === "demo" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600")}>{page.status === "published" ? "منتشر" : page.status === "demo" ? "دمو · ذخیره نشده" : "پیش‌نویس"}</span></span><small className="mt-1 block text-slate-500" dir="ltr">{["about", "contact", "terms"].includes(page.slug) ? "/" + page.slug : "/pages/" + page.slug}</small></button>{page.id > 0 && !["home", "about", "contact", "terms"].includes(page.slug) && <button type="button" onClick={() => void trashPage(page)} className="btn-sm mt-2 text-rose-600"><Trash2 className="size-3.5"/>انتقال به زباله</button>}</article>)}</div>
      {!pages.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">هنوز صفحه‌ای ایجاد نشده است.</p>}
    </section>

    {draft && <section className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">{draft.id ? "ویرایش صفحه" : "ساخت صفحه جدید"}</h2><p className="text-xs text-slate-500">چیدمان، محتوا و نسخه‌های صفحه را از همین‌جا مدیریت کنید.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPreviewOpen(true)} className="btn-ghost"><Eye className="size-4"/>پیش‌نمایش زنده</button>{draft.id && <button type="button" onClick={() => void openHistory()} className="btn-ghost"><History className="size-4"/>نسخه‌های قبلی</button>}</div></div>
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-bold">الگوی آماده صفحه<select className="input mt-1" value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>{Object.entries(pagePresets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}</select></label><button type="button" className="btn-ghost" onClick={applyPreset}><LayoutTemplate className="size-4"/>استفاده از الگو</button><p className="text-xs leading-6 text-amber-900 sm:max-w-xs">الگوها فقط پیش‌نویس فعلی را تغییر می‌دهند؛ انتشار پس از ذخیره و انتخاب وضعیت انجام می‌شود.</p></div>
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><b>سکشن جدید {new Intl.NumberFormat("fa-IR").format(index + 1)}</b><div className="flex gap-1"><button type="button" disabled={index === 0} className="btn-sm" title="بالا" onClick={() => patchPage("blocks", draft.blocks.map((x, i, a) => i === index ? a[index - 1] : i === index - 1 ? a[index] : x))}><ArrowUp className="size-4"/></button><button type="button" disabled={index === draft.blocks.length - 1} className="btn-sm" title="پایین" onClick={() => patchPage("blocks", draft.blocks.map((x, i, a) => i === index ? a[index + 1] : i === index + 1 ? a[index] : x))}><ArrowDown className="size-4"/></button><button type="button" className="btn-sm text-rose-600" onClick={() => patchPage("blocks", draft.blocks.filter((_, i) => i !== index))}>حذف بخش</button></div></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">نوع بخش<select className="input mt-1" value={block.type} onChange={(e) => patchBlock(index, { ...newBlock(e.target.value as Block["type"]), title: block.title })}><option value="hero">بنر / معرفی</option><option value="text">متن و توضیح</option><option value="features">کارت‌های ویژگی</option><option value="image">تصویر</option><option value="cta">دعوت به اقدام</option><option value="faq">سؤالات متداول</option><option value="grid">گرید محتوایی</option><option value="slider">اسلایدر</option><option value="columns">ستون‌بندی تو‌در‌تو</option><option value="form">فرم عمومی</option><option value="shortcode">شورت‌کد</option></select></label>
            <label className="text-sm">عنوان بخش<input className="input mt-1" value={block.title ?? ""} onChange={(e) => patchBlock(index, { title: e.target.value })} /></label>
            {["hero", "text", "image", "cta", "grid", "slider", "columns"].includes(block.type) && <label className="text-sm md:col-span-2">متن بخش<textarea className="input mt-1 min-h-24" value={block.body ?? ""} onChange={(e) => patchBlock(index, { body: e.target.value })} /></label>}
            {["hero", "image"].includes(block.type) && <div className="text-sm md:col-span-2"><span className="mb-2 block">تصویر از مرکز فایل</span><ImageUploader value={block.mediaId ? [block.mediaId] : []} max={1} onChange={(ids) => patchBlock(index, { mediaId: ids[0] ?? null })}/><input className="input mt-2" placeholder="زیرنویس تصویر" value={block.caption ?? ""} onChange={(e) => patchBlock(index, { caption: e.target.value })}/></div>}
            {["features", "faq"].includes(block.type) && <label className="text-sm md:col-span-2">{block.type === "faq" ? "پرسش و پاسخ (هر ردیف: پرسش | پاسخ)" : "کارت‌ها (هر ردیف: عنوان | توضیح)"}<textarea className="input mt-1 min-h-32" value={itemText(block.items)} onChange={(e) => patchBlock(index, { items: parseItems(e.target.value) })} placeholder={"عنوان اول | توضیحات\nعنوان دوم | توضیحات"} /></label>}
            {["grid", "slider"].includes(block.type) && <div className="space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{block.type === "slider" ? "اسلایدها" : "خانه‌های گرید"}</b><p className="text-xs text-slate-500">{block.type === "slider" ? "برای هر اسلاید تصویر، تیتر، متن و دکمه تعیین کنید." : "هر خانه می‌تواند متن، تصویر یا فراخوان به اقدام داشته باشد."}</p></div><button type="button" className="btn-sm" onClick={() => patchItems(index, [...(block.items ?? []), newItem()])}><Plus className="size-4"/>{block.type === "slider" ? "افزودن اسلاید" : "افزودن خانه"}</button></div>
              {(block.items ?? []).map((item, itemIndex) => <div key={itemIndex} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-3 flex items-center justify-between"><b className="text-sm">{block.type === "slider" ? "اسلاید " + (itemIndex + 1) : "خانه " + (itemIndex + 1)}</b><div className="flex gap-1"><button type="button" className="btn-sm" title="انتقال به بالا" disabled={itemIndex === 0} onClick={() => { const items=[...(block.items??[])]; [items[itemIndex-1],items[itemIndex]]=[items[itemIndex],items[itemIndex-1]]; patchItems(index,items); }}><ArrowUp className="size-3.5"/></button><button type="button" className="btn-sm" title="انتقال به پایین" disabled={itemIndex === (block.items?.length ?? 0)-1} onClick={() => { const items=[...(block.items??[])]; [items[itemIndex+1],items[itemIndex]]=[items[itemIndex],items[itemIndex+1]]; patchItems(index,items); }}><ArrowDown className="size-3.5"/></button><button type="button" className="btn-sm text-rose-600" onClick={() => patchItems(index,(block.items??[]).filter((_,j)=>j!==itemIndex))}><Trash2 className="size-3.5"/>حذف</button></div></div>
                {block.type === "grid" && <label className="mb-3 block text-xs font-bold">نوع محتوا<select className="input mt-1" value={item.kind ?? "text"} onChange={(e) => patchItem(index,itemIndex,{kind:e.target.value as SitePageBlockItem["kind"]})}><option value="text">متن</option><option value="image">تصویر و متن</option><option value="cta">فراخوان به اقدام</option></select></label>}
                {(block.type === "slider" || item.kind === "image") && <div className="mb-3"><span className="mb-1 block text-xs font-bold">تصویر</span><ImageUploader value={item.mediaId ? [item.mediaId] : []} max={1} onChange={(ids)=>patchItem(index,itemIndex,{mediaId:ids[0]??null})}/></div>}
                <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold">تیتر<input className="input mt-1" value={item.title} onChange={(e)=>patchItem(index,itemIndex,{title:e.target.value})}/></label><label className="text-xs font-bold">متن<textarea className="input mt-1 min-h-20" value={item.body} onChange={(e)=>patchItem(index,itemIndex,{body:e.target.value})}/></label>
                  {block.type === "slider" && <label className="text-xs font-bold md:col-span-2">زیرنویس تصویر<input className="input mt-1" value={item.caption??""} onChange={(e)=>patchItem(index,itemIndex,{caption:e.target.value})}/></label>}
                  {(block.type === "slider" || item.kind === "cta") && <><label className="text-xs font-bold">متن دکمه<input className="input mt-1" value={item.buttonLabel??""} onChange={(e)=>patchItem(index,itemIndex,{buttonLabel:e.target.value})}/></label><label className="text-xs font-bold">پیوند دکمه<input className="input mt-1" dir="ltr" placeholder="/shop" value={item.href??""} onChange={(e)=>patchItem(index,itemIndex,{href:e.target.value})}/></label></>}
                </div>
              </div>)}
              {!block.items?.length && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">هنوز موردی اضافه نشده است.</p>}
            </div>}
            {block.type === "columns" && <div className="md:col-span-2 rounded-2xl border border-dashed border-amber-300 p-4 dark:border-amber-800">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><b>چیدمان واکنش‌گرا</b><p className="mt-1 text-xs leading-6 text-slate-500">برای هر ستون، محتوا و ترتیب موبایل را جداگانه تنظیم کنید. حداکثر ۶ ستون.</p></div><button type="button" disabled={(block.columns?.length ?? 0) >= 6} className="btn-sm" onClick={() => patchBlock(index,{columns:[...(block.columns ?? []),{id:builderId(),blocks:[]}]})}><Plus className="size-4"/>افزودن ستون</button></div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">ستون دسکتاپ<select className="input mt-1" value={block.style?.columns ?? Math.max(1,block.columns?.length ?? 1)} onChange={e=>patchStyle(index,{columns:Number(e.target.value)})}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} ستون</option>)}</select></label><label className="text-xs font-bold">ستون تبلت<select className="input mt-1" value={block.style?.tabletColumns ?? 2} onChange={e=>patchStyle(index,{tabletColumns:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} ستون</option>)}</select></label><label className="text-xs font-bold">ستون موبایل<select className="input mt-1" value={block.style?.mobileColumns ?? 1} onChange={e=>patchStyle(index,{mobileColumns:Number(e.target.value)})}><option value={1}>یک ستون</option><option value={2}>دو ستون</option></select></label></div>
              <div className="space-y-4">{(block.columns ?? []).map((column,columnIndex)=><div key={column.id} className="min-w-0 space-y-3 rounded-xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2"><b>ستون {new Intl.NumberFormat("fa-IR").format(columnIndex+1)}</b><div className="flex flex-wrap items-center gap-2"><label className="text-xs">ترتیب موبایل<input className="input mt-1 w-20" type="number" min="0" max="20" value={column.mobileOrder ?? columnIndex} onChange={e=>patchColumn(index,columnIndex,{mobileOrder:Number(e.target.value)})}/></label><label className="text-xs">عرض دسکتاپ<select className="input mt-1 w-24" value={column.desktopSpan ?? 1} onChange={e=>patchColumn(index,columnIndex,{desktopSpan:Number(e.target.value)})}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} واحد</option>)}</select></label><button type="button" className="btn-sm text-rose-600" disabled={(block.columns?.length ?? 0)<=1} onClick={()=>patchBlock(index,{columns:(block.columns ?? []).filter((_,j)=>j!==columnIndex)})}><Trash2 className="size-4"/>حذف ستون</button></div></div>
                <div className="space-y-3">{column.blocks.map((child,childIndex)=><div key={child.id ?? childIndex} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><div className="mb-2 flex items-center justify-between gap-2"><b className="text-xs">{child.type === "image" ? "تصویر" : child.type === "cta" ? "دعوت به اقدام" : child.type === "shortcode" ? "شورت‌کد" : child.type === "columns" ? "ستون‌بندی" : "محتوای متنی"} {childIndex+1}</b><div className="flex gap-1"><button type="button" className="btn-sm" aria-label="انتقال آیتم به بالا" disabled={childIndex===0} onClick={()=>{const blocks=[...column.blocks];[blocks[childIndex-1],blocks[childIndex]]=[blocks[childIndex],blocks[childIndex-1]];patchColumn(index,columnIndex,{blocks})}}><ArrowUp className="size-3.5"/></button><button type="button" className="btn-sm" aria-label="انتقال آیتم به پایین" disabled={childIndex===column.blocks.length-1} onClick={()=>{const blocks=[...column.blocks];[blocks[childIndex+1],blocks[childIndex]]=[blocks[childIndex],blocks[childIndex+1]];patchColumn(index,columnIndex,{blocks})}}><ArrowDown className="size-3.5"/></button><button type="button" className="btn-sm text-rose-600" onClick={()=>patchColumn(index,columnIndex,{blocks:column.blocks.filter((_,j)=>j!==childIndex)})}><Trash2 className="size-3.5"/>حذف</button></div></div>{child.type === "image" && <div className="mb-3"><ImageUploader value={child.mediaId?[child.mediaId]:[]} max={1} onChange={ids=>patchNestedBlock(index,columnIndex,childIndex,{mediaId:ids[0]??null})}/></div>}<div className="grid gap-2 md:grid-cols-2"><label className="text-xs font-bold">عنوان<input className="input mt-1" value={child.title ?? ""} onChange={e=>patchNestedBlock(index,columnIndex,childIndex,{title:e.target.value})}/></label>{child.type === "shortcode" ? <div className="space-y-2 md:col-span-2"><ShortcodeInsert onInsert={(token) => patchNestedBlock(index,columnIndex,childIndex,{body:[child.body?.trim(),token].filter(Boolean).join("\n\n")})}/><label className="block text-xs font-bold">شورت‌کدها<textarea dir="ltr" spellCheck={false} className="input mt-1 min-h-28 font-mono text-xs" value={child.body ?? ""} onChange={e=>patchNestedBlock(index,columnIndex,childIndex,{body:e.target.value})} placeholder={'{{products category="روغن" limit="6"}}'}/></label><p className="text-xs leading-6 text-slate-500">محتوای کوتاه‌کد پس از ذخیره در صفحهٔ عمومی اجرا می‌شود.</p></div> : <label className="text-xs font-bold">متن<textarea className="input mt-1 min-h-20" value={child.body ?? ""} onChange={e=>patchNestedBlock(index,columnIndex,childIndex,{body:e.target.value})}/></label>}{child.type === "image" && <label className="text-xs font-bold">زیرنویس تصویر<input className="input mt-1" value={child.caption ?? ""} onChange={e=>patchNestedBlock(index,columnIndex,childIndex,{caption:e.target.value})}/></label>}{child.type === "cta" && <><label className="text-xs font-bold">متن دکمه<input className="input mt-1" value={child.buttonLabel ?? ""} onChange={e=>patchNestedBlock(index,columnIndex,childIndex,{buttonLabel:e.target.value})}/></label><label className="text-xs font-bold">پیوند دکمه<input className="input mt-1" dir="ltr" placeholder="/shop" value={child.href ?? ""} onChange={e=>patchNestedBlock(index,columnIndex,childIndex,{href:e.target.value})}/></label></>}</div></div>)}
                  <div className="flex flex-wrap items-center gap-2"><select aria-label="نوع محتوای تو‌در‌تو" className="input w-auto min-w-36" value={nestedBlockType} onChange={e=>setNestedBlockType(e.target.value as Block["type"])}><option value="text">متن</option><option value="image">تصویر</option><option value="cta">دعوت به اقدام</option><option value="shortcode">شورت‌کد</option></select><button type="button" className="btn-sm" disabled={column.blocks.length>=20} onClick={()=>patchColumn(index,columnIndex,{blocks:[...column.blocks,createBlock(nestedBlockType)]})}><Plus className="size-4"/>افزودن آیتم</button></div>
                </div></div>)}{!(block.columns?.length) && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">ستونی اضافه نشده است.</p>}</div>
            </div>}
            <details className="md:col-span-2 rounded-xl border p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-bold">استایل و CSS سفارشی این سکشن</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs font-bold">CSS دسکتاپ<textarea dir="ltr" spellCheck={false} className="input mt-1 min-h-28 font-mono text-xs" placeholder="& { padding: 2rem; }\n& h2 { color: #805b00; }" value={block.style?.customCss ?? ""} onChange={e=>patchStyle(index,{customCss:e.target.value})}/></label><label className="text-xs font-bold">CSS موبایل<textarea dir="ltr" spellCheck={false} className="input mt-1 min-h-28 font-mono text-xs" placeholder="& { padding: 1rem; }" value={block.style?.customCssMobile ?? ""} onChange={e=>patchStyle(index,{customCssMobile:e.target.value})}/></label><p className="text-xs leading-6 text-slate-500 md:col-span-2">برای ایمنی، هر انتخابگر باید با <code dir="ltr">&</code> شروع شود تا فقط روی همین سکشن اثر کند؛ اجرای اسکریپت و نشانی خارجی در CSS مسدود است.</p></div></details>
            {block.type === "cta" && <><label className="text-sm">متن دکمه<input className="input mt-1" value={block.buttonLabel ?? ""} onChange={(e) => patchBlock(index, { buttonLabel: e.target.value })}/></label><label className="text-sm">نشانی دکمه<input className="input mt-1" dir="ltr" placeholder="/shop" value={block.href ?? ""} onChange={(e) => patchBlock(index, { href: e.target.value })}/></label></>}
            {block.type === "form" && <label className="text-sm md:col-span-2">انتخاب فرم منتشرشده<select className="input mt-1" value={block.formSlug ?? ""} onChange={(e) => patchBlock(index, { formSlug: e.target.value })}><option value="">یک فرم را انتخاب کنید</option>{initialForms.filter((form) => form.status === "published").map((form) => <option key={form.id} value={form.slug}>{form.title} · /forms/{form.slug}</option>)}</select>{!initialForms.some((form) => form.status === "published") && <span className="mt-1 block text-xs text-amber-800">فرم منتشرشده‌ای وجود ندارد. ابتدا از بخش فرم‌های عمومی یک فرم بسازید و منتشر کنید.</span>}</label>}
            {block.type === "shortcode" && <div className="space-y-2 md:col-span-2"><ShortcodeInsert onInsert={(token) => patchBlock(index, { body: [block.body?.trim(), token].filter(Boolean).join("\n\n") })}/><label className="block text-sm">شورت‌کدها<textarea dir="ltr" className="input mt-1 min-h-32 font-mono text-xs" value={block.body ?? ""} onChange={(e) => patchBlock(index, { body: e.target.value })} placeholder={'{{products category="روغن" limit="6"}}'} /></label><p className="text-xs leading-6 text-slate-500">از دکمهٔ افزودن محتوای آماده برای درج محصولات، کاروسل مقاله یا ویدیو استفاده کنید. پیش‌نمایش اجرایی پس از ذخیره در صفحه عمومی نمایش داده می‌شود.</p></div>}
          </div>
        </article>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2"><select aria-label="نوع سکشن جدید" className="input w-auto min-w-40" value={newBlockType} onChange={(e)=>setNewBlockType(e.target.value as Block["type"])}><option value="text">متن و توضیح</option><option value="image">تصویر</option><option value="hero">بنر</option><option value="grid">گرید جدید</option><option value="slider">اسلایدر جدید</option><option value="columns">ستون‌بندی تو‌در‌تو</option><option value="features">کارت‌های ویژگی</option><option value="cta">دعوت به اقدام</option><option value="faq">سؤالات متداول</option><option value="form">فرم عمومی</option><option value="shortcode">شورت‌کد</option></select><button type="button" className="btn-ghost" onClick={() => patchPage("blocks", [...draft.blocks, newBlock(newBlockType)])}><Plus className="size-4"/>افزودن سکشن</button></div><div className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => setDraft(null)}>انصراف</button><button type="button" disabled={busy} className="btn-primary" onClick={savePage}><Save className="size-4"/>{busy ? "در حال ذخیره…" : "ذخیره صفحه"}</button></div></div>
    </section>}

    {previewOpen && draft && <div className="site-content-preview fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="پیش‌نمایش زنده صفحه"><section className="flex h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b px-4 py-3"><div><b>پیش‌نمایش زنده</b><p className="text-xs text-slate-500">تغییرات ذخیره‌نشدهٔ همین ویرایشگر · {draft.template}</p></div><button type="button" className="btn-sm" onClick={() => setPreviewOpen(false)}><X className="size-4"/>بستن</button></header><div className="min-h-0 flex-1 overflow-auto bg-stone-50"><main className={(draft.template === "editorial" ? "max-w-4xl" : draft.template === "minimal" ? "max-w-3xl" : "max-w-6xl") + " mx-auto space-y-7 px-4 py-8 sm:py-12"}><div className="mb-8 border-b border-amber-200 pb-4"><small className="text-amber-800">پیش‌نمایش صفحه</small><h1 className="mt-2 text-3xl font-black">{draft.title || "عنوان صفحه"}</h1>{draft.summary && <p className="mt-2 text-slate-600">{draft.summary}</p>}</div>{draft.blocks.map((block, index) => <PageBlockFrame key={block.id || index} block={block}><SiteBlockContent block={block} primary={index === 0}/></PageBlockFrame>)}{draft.template === "contact" && <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">اطلاعات تماس از تنظیمات عمومی سایت در صفحهٔ منتشرشده نمایش داده می‌شود.</div>}</main></div></section></div>}

    {historyOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="نسخه‌های صفحه"><section className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-4"><div><b>نسخه‌های ذخیره‌شده</b><p className="text-xs text-slate-500">حداکثر ۲۰ نسخهٔ اخیر نگهداری می‌شود.</p></div><button type="button" className="btn-sm" onClick={() => setHistoryOpen(false)}><X className="size-4"/>بستن</button></header><div className="max-h-[calc(100dvh-10rem)] space-y-2 overflow-auto p-4">{historyBusy ? <p className="p-5 text-center text-sm text-slate-500">در حال دریافت نسخه‌ها…</p> : revisions.length ? revisions.map((revision) => <article key={revision.id} className="flex flex-col justify-between gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"><div><b>{revision.document.title}</b><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.createdAt))} · {revision.document.blocks?.length ?? 0} بخش · {revision.document.status === "published" ? "منتشر" : "پیش‌نویس"}</p></div><button type="button" disabled={busy} className="btn-sm" onClick={() => void restoreRevision(revision.id)}>بازیابی به‌صورت پیش‌نویس</button></article>) : <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">برای صفحه نسخه‌ای ثبت نشده است. از این پس پیش از هر تغییر، نسخهٔ قبلی نگهداری می‌شود.</p>}</div></section></div>}

    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div><h2 className="font-extrabold text-emerald-900">ویرایش منوهای سایت</h2><p className="mt-1 text-sm text-emerald-800">منوهای هدر، فوتر و موبایل اکنون در منوساز چندجایگاهی مدیریت می‌شوند.</p></div><Link href="/admin/menus" className="btn-primary">رفتن به منوساز</Link></section>
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
