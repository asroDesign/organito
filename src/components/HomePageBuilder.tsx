"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Copy, Download, Eye, EyeOff, GripVertical, History, Layers, Loader2, Monitor, Plus, Redo2, Save, Search, Settings2, Smartphone, Tablet, Trash2, Undo2, Upload, X } from "lucide-react";
import type { HomeBuilderDocument, HomeBuilderRevision, SitePageBlock } from "@/db/schema";
import type { ShopProduct } from "@/lib/queries";
import { BLOCK_LABELS, blockLabel, builderId, createBlock, identifyBlocks, normalizeDocument } from "@/lib/page-builder";
import { HOME_SECTION_LABELS } from "@/lib/home-page-builder";
import { HomeBuilderInspector, Field } from "./HomeBuilderInspector";
import { toast } from "./client";

type State = { draft: HomeBuilderDocument; version: number; revisions: HomeBuilderRevision[]; published: HomeBuilderDocument | null };
type HistoryState = { past: HomeBuilderDocument[]; present: HomeBuilderDocument; future: HomeBuilderDocument[] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function BuilderDialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={ref} dir="rtl" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }} className="m-auto max-h-[85dvh] w-[min(94vw,850px)] overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4"><h2 className="font-black">{title}</h2><button aria-label="بستن" onClick={close} className="btn-sm"><X className="size-4"/></button></header><div className="p-5">{children}</div></dialog>;
}

export function HomePageBuilder({ initial, categories, products: initialProducts, presetBlocks, userId }: { initial: State; categories: { id: number; name: string }[]; products: ShopProduct[]; presetBlocks: SitePageBlock[]; userId: number }) {
  const [initialDoc] = useState(() => ({ ...initial.draft, blocks: identifyBlocks(initial.draft.blocks) }));
  const [history, setHistory] = useState<HistoryState>({ past: [], present: initialDoc, future: [] });
  const doc = history.present;
  const docRef = useRef(doc), versionRef = useRef(initial.version), savedRef = useRef(JSON.stringify(initialDoc));
  const queue = useRef<Promise<void>>(Promise.resolve()), conflictRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(() => JSON.stringify(initialDoc)), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [selected, setSelected] = useState(doc.blocks[0]?.id || ""), [device, setDevice] = useState("desktop");
  const [panel, setPanel] = useState("canvas"), [modal, setModal] = useState<string | null>(null);
  const [revisions, setRevisions] = useState(initial.revisions), [recovery, setRecovery] = useState<HomeBuilderDocument | null>(null), [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState(initialProducts), [query, setQuery] = useState(""), [foundProducts, setFoundProducts] = useState(initialProducts.slice(0, 40)), [searchBusy, setSearchBusy] = useState(false);
  const [picked, setPicked] = useState<number[]>([]), [librarySearch, setLibrarySearch] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [previewSlow, setPreviewSlow] = useState(false), [previewKey, setPreviewKey] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 700 });
  const viewportWidth = device === "mobile" ? 390 : device === "tablet" ? 768 : 1280;
  const scale = Math.min(1, canvasSize.width / viewportWidth);
  const frame = useRef<HTMLIFrameElement>(null), fileInput = useRef<HTMLInputElement>(null), dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState("");
  const key = `home-builder-recovery:${userId}`;
  const active = doc.blocks.find(b => b.id === selected);
  const dirty = JSON.stringify(doc) !== saved;
  const change = useCallback((update: (d: HomeBuilderDocument) => HomeBuilderDocument) => setHistory(h => {
    const next = update(h.present);
    if (JSON.stringify(next) === JSON.stringify(h.present)) return h;
    return { past: [...h.past.slice(-79), h.present], present: next, future: [] };
  }), []);
  const undo = useCallback(() => setHistory(h => !h.past.length ? h : { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }), []);
  const redo = useCallback(() => setHistory(h => !h.future.length ? h : { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }), []);
  const patch = (values: Partial<SitePageBlock>) => change(d => ({ ...d, blocks: d.blocks.map(b => b.id === selected ? { ...b, ...values } : b) }));
  const move = (id: string, to: number) => change(d => {
    const blocks = [...d.blocks], from = blocks.findIndex(b => b.id === id);
    if (from < 0 || to < 0 || to >= blocks.length) return d;
    const [b] = blocks.splice(from, 1); blocks.splice(to, 0, b); return { ...d, blocks };
  });
  const add = (type: SitePageBlock["type"], sectionId?: string) => {
    if (doc.blocks.length >= 60) { toast("حداکثر ۶۰ بخش مجاز است", false); return; }
    const preset = type === "store_section" ? presetBlocks.find(b => b.sectionId === sectionId) : null;
    const block = preset ? { ...clone(preset), id: builderId() } : createBlock(type, sectionId);
    change(d => { const blocks = [...d.blocks], i = blocks.findIndex(b => b.id === selected); blocks.splice(i < 0 ? blocks.length : i + 1, 0, block); return { ...d, blocks }; });
    setSelected(block.id!); setModal(null); setPanel("inspector");
  };
  const duplicate = (block: SitePageBlock) => {
    if (doc.blocks.length >= 60) return;
    const copy = { ...clone(block), id: builderId(), anchor: "", name: `${blockLabel(block)} (کپی)`, items: block.items?.map(it => ({ ...it, id: builderId() })) };
    change(d => { const blocks = [...d.blocks]; blocks.splice(blocks.findIndex(b => b.id === block.id) + 1, 0, copy); return { ...d, blocks }; }); setSelected(copy.id);
  };
  const save = useCallback((action: "save" | "publish") => {
    const snapshot = clone(docRef.current), json = JSON.stringify(snapshot);
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (conflictRef.current || (action === "save" && savedRef.current === json)) return;
      setSaving(true); setError("");
      try {
        const response = await fetch("/api/admin/home-builder", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf": "1" }, body: JSON.stringify({ action, document: snapshot, version: versionRef.current }) });
        const result = await response.json();
        if (!response.ok) { if (response.status === 409) { conflictRef.current = true; setConflict(true); } throw new Error(result.error || "ذخیره انجام نشد"); }
        versionRef.current = result.version; savedRef.current = json; setSaved(json); setRevisions(result.revisions);
        if (action === "publish") toast("صفحه اصلی منتشر شد");
      } catch (e) { setError((e as Error).message); }
      finally { setSaving(false); }
    });
    return queue.current;
  }, []);
  useEffect(() => { docRef.current = doc; }, [doc]);
  useEffect(() => {
    const task = window.requestAnimationFrame(() => {
      try { const local = JSON.parse(localStorage.getItem(key) || "null"); if (local?.document && JSON.stringify(local.document) !== JSON.stringify(initialDoc)) setRecovery(normalizeDocument(local.document)); } catch { /* Invalid local recovery is ignored. */ }
      setLoaded(true);
    });
    return () => window.cancelAnimationFrame(task);
  }, [key, initialDoc]);
  useEffect(() => {
    if (!loaded || recovery) return;
    try { localStorage.setItem(key, JSON.stringify({ document: doc, version: versionRef.current })); } catch { /* The server draft remains available if browser storage is full. */ }
    if (!dirty || conflictRef.current) return;
    const timer = window.setTimeout(() => { void save("save"); }, 1500);
    return () => window.clearTimeout(timer);
  }, [doc, dirty, loaded, recovery, key, save]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (JSON.stringify(docRef.current) !== savedRef.current) { e.preventDefault(); e.returnValue = ""; } };
    const shortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "s") { e.preventDefault(); void save("save"); }
      const input = (e.target as HTMLElement).closest("input,textarea,[contenteditable]");
      if (!input && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if (!input && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("beforeunload", leave); window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("beforeunload", leave); window.removeEventListener("keydown", shortcut); };
  }, [save, undo, redo]);
  useEffect(() => {
    if (previewReady) return;
    const timer = window.setTimeout(() => setPreviewSlow(true), 20000);
    return () => window.clearTimeout(timer);
  }, [previewReady, previewKey]);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  const sendPreview = useCallback(() => { frame.current?.contentWindow?.postMessage({ type: "home-builder:update", blocks: docRef.current.blocks, products }, location.origin); }, [products]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "home-builder:ready") { setPreviewReady(true); sendPreview(); }
      if (e.data?.type === "home-builder:selected" && typeof e.data.id === "string") { setSelected(e.data.id); setPanel("inspector"); }
    };
    window.addEventListener("message", onMessage); return () => window.removeEventListener("message", onMessage);
  }, [sendPreview]);
  useEffect(() => { if (!previewReady) return; const timer = window.setTimeout(sendPreview, 160); return () => window.clearTimeout(timer); }, [doc, products, sendPreview, previewReady]);
  useEffect(() => { if (previewReady) frame.current?.contentWindow?.postMessage({ type: "home-builder:select", id: selected }, location.origin); }, [selected, previewReady]);
  useEffect(() => {
    if (modal !== "products") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      try { const r = await fetch(`/api/admin/home-builder/products?q=${encodeURIComponent(query)}`, { signal: controller.signal }); if (!r.ok) throw new Error("جست‌وجو انجام نشد"); const list = await r.json() as ShopProduct[]; setFoundProducts(list); setProducts(old => [...new Map([...old, ...list].map(p => [p.id, p])).values()]); }
      catch (e) { if (!controller.signal.aborted) toast((e as Error).message, false); }
      finally { if (!controller.signal.aborted) setSearchBusy(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [modal, query]);
  const exportDocument = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "organo-home", version: 1, document: docRef.current }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "home-page-design.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restore = (document: HomeBuilderDocument) => { change(() => ({ ...document, blocks: identifyBlocks(document.blocks) })); setSelected(document.blocks[0]?.id || ""); setModal(null); };
  return <div dir="rtl" className="fixed inset-0 z-[60] flex flex-col bg-slate-100 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-3 shadow-sm sm:px-5">
      <div className="flex items-center gap-3"><Link href="/admin/site-content" aria-label="بازگشت به مدیریت محتوا" className="rounded-xl border p-2" onClick={e => { if (dirty && !window.confirm("تغییرات هنوز ذخیره نشده‌اند. خارج می‌شوید؟")) e.preventDefault(); }}><X className="size-4"/></Link><span className="hidden rounded-xl bg-amber-400 p-2 sm:block"><Layers className="size-5"/></span><div><h1 className="text-sm font-black sm:text-base">صفحه‌ساز صفحه اصلی</h1><span aria-live="polite" className={`text-[11px] ${error ? "text-rose-600" : "text-slate-500"}`}>{saving ? "در حال ذخیره پیش‌نویس…" : error ? "ذخیره ناموفق" : dirty ? "تغییرات ذخیره‌نشده" : "پیش‌نویس ذخیره شده"}</span></div></div>
      <div className="flex items-center gap-1"><button title="بازگشت تغییر (Ctrl+Z)" className="btn-sm" disabled={!history.past.length} onClick={undo}><Undo2 className="size-4"/></button><button title="انجام دوباره" className="btn-sm" disabled={!history.future.length} onClick={redo}><Redo2 className="size-4"/></button><div className="mx-2 hidden items-center gap-1 rounded-xl bg-slate-100 p-1 sm:flex">{[["desktop", Monitor, "دسکتاپ"], ["tablet", Tablet, "تبلت"], ["mobile", Smartphone, "موبایل"]].map(([id, Icon, label]) => { const I = Icon as typeof Monitor; return <button key={id as string} title={label as string} onClick={() => setDevice(id as string)} className={`rounded-lg p-2 ${device === id ? "bg-white shadow-sm" : "text-slate-400"}`}><I className="size-4"/></button>; })}</div><button title="تنظیمات صفحه و سئو" className="btn-sm" onClick={() => setModal("settings")}><Settings2 className="size-4"/></button><button title="نسخه‌های قبلی" className="btn-sm" onClick={() => setModal("history")}><History className="size-4"/></button></div>
      <div className="flex items-center gap-2"><button className="btn-ghost !text-xs" disabled={saving} onClick={() => void save("save")}><Save className="size-4"/><span className="hidden sm:inline">ذخیره پیش‌نویس</span></button><button className="btn-primary !text-xs" disabled={saving || !!recovery || conflict} onClick={() => void save("publish")}>{saving ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>}انتشار تغییرات</button></div>
    </header>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 px-4 py-2 text-xs text-rose-800"><span>{error}</span><div className="flex gap-3"><button onClick={exportDocument}>خروجی تغییرات</button>{conflict ? <button onClick={() => window.location.reload()}>دریافت نسخه جدید سرور</button> : <button onClick={() => void save("save")}>تلاش مجدد</button>}</div></div>}
    {recovery && <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-xs"><span>یک نسخه محلی متفاوت پیدا شد. آن را به پیش‌نویس برگردانید یا نسخه سرور را نگه دارید.</span><div className="flex gap-3"><button className="font-bold" onClick={() => { restore(recovery); setRecovery(null); }}>بازیابی نسخه محلی</button><button onClick={() => setRecovery(null)}>استفاده از نسخه سرور</button></div></div>}
    <nav className="flex justify-around border-b bg-white p-2 lg:hidden">{[["layers", "لایه‌ها"], ["canvas", "پیش‌نمایش"], ["inspector", "ویرایش"]].map(([id, label]) => <button key={id} className={`rounded-lg px-4 py-2 text-xs ${panel === id ? "bg-amber-100" : ""}`} onClick={() => setPanel(id)}>{label}</button>)}<select aria-label="اندازه پیش‌نمایش" value={device} onChange={e => setDevice(e.target.value)} className="rounded border text-xs"><option value="desktop">دسکتاپ</option><option value="tablet">تبلت</option><option value="mobile">موبایل</option></select></nav>
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_310px] xl:grid-cols-[250px_minmax(0,1fr)_340px]">
      <aside className={`${panel === "layers" ? "flex" : "hidden"} min-h-0 flex-col border-l bg-white lg:flex`}><div className="flex items-center justify-between border-b p-4"><b className="text-sm">لایه‌های صفحه <span className="text-slate-400">{doc.blocks.length}</span></b><button title="افزودن سکشن" className="rounded-lg bg-amber-400 p-2" onClick={() => setModal("library")}><Plus className="size-4"/></button></div><div className="flex-1 space-y-2 overflow-y-auto p-3">{doc.blocks.map((block, i) => <div key={block.id} draggable onDragStart={e => { dragId.current = block.id!; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", block.id!); }} onDragOver={e => { e.preventDefault(); setDragOver(block.id!); }} onDrop={e => { e.preventDefault(); if (dragId.current) move(dragId.current, i); dragId.current = null; setDragOver(""); }} onDragEnd={() => { dragId.current = null; setDragOver(""); }} className={`rounded-xl border p-2 ${selected === block.id ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200" : "border-slate-200"} ${dragOver === block.id ? "border-t-4 border-t-amber-500" : ""} ${block.enabled === false ? "opacity-50" : ""}`}><button className="flex w-full items-center gap-2 text-right" onClick={() => { setSelected(block.id!); setPanel("inspector"); }}><GripVertical className="size-4 shrink-0 text-slate-400"/><span className="min-w-0 flex-1 truncate text-xs font-bold">{blockLabel(block)}</span><small className="text-[10px] text-slate-400">{i + 1}</small></button><div className="mt-2 flex justify-end gap-0.5">{[[ArrowUp, "بالا", () => move(block.id!, i - 1), i === 0], [ArrowDown, "پایین", () => move(block.id!, i + 1), i === doc.blocks.length - 1], [block.enabled === false ? EyeOff : Eye, "نمایش یا پنهان", () => change(d => ({ ...d, blocks: d.blocks.map(b => b.id === block.id ? { ...b, enabled: b.enabled === false } : b) })), false], [Copy, "تکثیر", () => duplicate(block), doc.blocks.length >= 60], [Trash2, "حذف سکشن", () => change(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== block.id) })), false]].map(([Icon, label, fn, disabled]) => { const I = Icon as typeof Eye; return <button key={label as string} title={label as string} aria-label={`${label}: ${blockLabel(block)}`} disabled={disabled as boolean} onClick={fn as () => void} className="rounded p-1.5 text-slate-500 hover:bg-white disabled:opacity-25"><I className="size-3.5"/></button>; })}</div></div>)}{!doc.blocks.length && <p className="p-4 text-center text-xs leading-7 text-slate-500">صفحه خالی است. اولین بخش را از کتابخانه اضافه کنید.</p>}</div><div className="border-t p-3"><button className="btn-primary w-full" onClick={() => setModal("library")}><Plus className="size-4"/>افزودن بخش جدید</button><p className="mt-2 text-center text-[10px] text-slate-400">برای جابه‌جایی بکشید یا از فلش‌ها استفاده کنید.</p></div></aside>
      <section className={`${panel === "canvas" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col lg:flex`}><div className="flex items-center justify-between gap-2 px-4 py-3 text-[11px] text-slate-500"><span>روی هر بخش صفحه کلیک کنید تا ویرایش شود.</span><a href="/" target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1"><Eye className="size-3"/>نسخه منتشرشده</a></div><div ref={canvas} className="relative min-h-0 flex-1 overflow-hidden" dir="ltr"><div className="relative mx-auto h-full" style={{ width: viewportWidth * scale }}><iframe key={previewKey} ref={frame} title="پیش‌نمایش زنده صفحه اصلی" src="/home-builder-preview" className="block border bg-white shadow-lg" style={{ width: viewportWidth, height: Math.max(400, canvasSize.height / scale), transform: `scale(${scale})`, transformOrigin: "top left" }} /> </div>{!previewReady && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70"><div className="rounded-xl bg-white p-4 text-sm shadow"><span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin"/>در حال آماده‌سازی پیش‌نمایش</span>{previewSlow && <button className="btn-ghost mt-3" onClick={() => { setPreviewSlow(false); setPreviewKey(k => k + 1); }}>بارگذاری دوباره پیش‌نمایش</button>}</div></div>}</div></section>
      <aside className={`${panel === "inspector" ? "block" : "hidden"} min-h-0 overflow-y-auto border-r bg-white lg:block`}>{active ? <HomeBuilderInspector key={active.id} block={active} patch={patch} categories={categories} pickProducts={() => { setPicked(active.options?.productIds || []); setQuery(""); setModal("products"); }}/> : <div className="p-8 text-center text-sm leading-8 text-slate-500"><Settings2 className="mx-auto mb-4 size-8 text-amber-500"/>یک بخش از صفحه یا فهرست لایه‌ها را انتخاب کنید.</div>}</aside>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-white px-4 py-2 text-[10px] text-slate-500"><span>ذخیره خودکار پیش‌نویس · تغییرات فقط با «انتشار» در سایت نمایش داده می‌شوند.</span><span>Ctrl/Cmd + S ذخیره · Ctrl/Cmd + Z بازگشت</span></footer>
    {modal === "library" && <BuilderDialog title="کتابخانه بخش‌ها" close={() => setModal(null)}><div className="relative mb-5"><Search className="absolute right-3 top-3 size-4 text-slate-400"/><input autoFocus className="input !pr-9" placeholder="جست‌وجوی بخش…" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)}/></div><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><div><b className="text-sm">طرح کامل فروشگاه</b><p className="mt-1 text-xs text-slate-500">جایگزینی پیش‌نویس با ۱۳ بخش اصلی فروشگاه؛ قابل بازگشت.</p></div><button className="btn-ghost" onClick={() => { change(d => ({ ...d, blocks: identifyBlocks(presetBlocks.map(b => ({ ...b, id: builderId() }))) })); setModal(null); setSelected(""); }}>استفاده از طرح اصلی</button></div><h3 className="mb-3 text-sm font-bold">بخش‌های محتوایی</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(BLOCK_LABELS).filter(([id, label]) => id !== "store_section" && label.includes(librarySearch)).map(([id, label]) => <button key={id} onClick={() => add(id as SitePageBlock["type"])} className="rounded-xl border p-4 text-right hover:border-amber-400 hover:bg-amber-50"><Layers className="mb-3 size-6 text-amber-500"/><b className="text-sm">{label}</b><span className="mt-2 block text-[10px] text-slate-500">تصویر، متن و تنظیمات دلخواه</span></button>)}</div><h3 className="mb-3 mt-6 text-sm font-bold">بخش‌های فعلی فروشگاه</h3><div className="grid gap-2 sm:grid-cols-3">{Object.entries(HOME_SECTION_LABELS).filter(([, label]) => label.includes(librarySearch)).map(([id, label]) => <button key={id} className="rounded-xl border p-3 text-right text-sm hover:bg-amber-50" onClick={() => add("store_section", id)}>{label}<small className="mt-1 block text-[10px] text-slate-400">همراه داده‌های زنده فروشگاه</small></button>)}</div></BuilderDialog>}
    {modal === "settings" && <BuilderDialog title="تنظیمات صفحه و انتقال طرح" close={() => setModal(null)}><div className="space-y-4"><Field label="نام صفحه در مدیریت" value={doc.title} onChange={title => change(d => ({ ...d, title }))}/><Field label="عنوان سئو صفحه اصلی" value={doc.metaTitle} placeholder="خالی: استفاده از تنظیمات عمومی" onChange={metaTitle => change(d => ({ ...d, metaTitle }))}/><Field label="توضیحات سئو" multiline value={doc.metaDescription} placeholder="خالی: استفاده از تنظیمات عمومی" onChange={metaDescription => change(d => ({ ...d, metaDescription }))}/><div className="rounded-xl bg-slate-50 p-4 text-xs leading-7">عنوان سئو: {doc.metaTitle.length.toLocaleString("fa-IR")} نویسه · توضیحات: {doc.metaDescription.length.toLocaleString("fa-IR")} نویسه<br/>تنظیمات سئو با انتشار صفحه اعمال می‌شوند.</div><div className="flex flex-wrap gap-2 border-t pt-4"><button className="btn-ghost" onClick={exportDocument}><Download className="size-4"/>خروجی طرح JSON</button><button className="btn-ghost" onClick={() => fileInput.current?.click()}><Upload className="size-4"/>ورود طرح JSON</button></div><p className="text-xs text-slate-500">ورود طرح جایگزین پیش‌نویس می‌شود و با بازگشت تغییر قابل بازیابی است. فایل طرح فقط شامل چیدمان و شناسه رسانه‌هاست.</p></div></BuilderDialog>}
    <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 2_000_000) throw new Error("حداکثر اندازه فایل طرح ۲ مگابایت است"); const payload = JSON.parse(await file.text()); if (payload.format !== "organo-home" || payload.version !== 1) throw new Error("فرمت فایل طرح معتبر نیست"); restore(normalizeDocument(payload.document)); toast("طرح در پیش‌نویس وارد شد"); } catch (err) { toast((err as Error).message, false); } }}/>
    {modal === "history" && <BuilderDialog title="نسخه‌های منتشرشده قبلی" close={() => setModal(null)}><p className="mb-4 text-sm leading-7 text-slate-500">۲۰ نسخه قبلی نگهداری می‌شود. بازیابی ابتدا در پیش‌نویس انجام می‌شود؛ پس از بررسی، انتشار دهید.</p>{!revisions.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm">هنوز نسخه قبلی وجود ندارد.</p>}<div className="space-y-3">{revisions.map(rev => <div key={rev.id} className="flex items-center justify-between gap-3 rounded-xl border p-4"><div><b className="text-sm">{new Date(rev.at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</b><small className="mt-1 block text-slate-500">{rev.document.blocks.length} بخش · {rev.document.title}</small></div><button className="btn-ghost" onClick={() => restore(rev.document)}>بازیابی در پیش‌نویس</button></div>)}</div></BuilderDialog>}
    {modal === "products" && active && <BuilderDialog title="انتخاب محصولات این بخش" close={() => setModal(null)}><input autoFocus className="input mb-4" placeholder="جست‌وجو با نام، برند یا کد محصول…" value={query} onChange={e => setQuery(e.target.value)}/><p className="mb-3 text-xs text-slate-500">{picked.length} محصول از حداکثر ۲۴ محصول انتخاب شده است.</p>{searchBusy && <p className="mb-3 text-xs">در حال جست‌وجو…</p>}<div className="max-h-[40vh] space-y-2 overflow-y-auto">{foundProducts.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={picked.includes(p.id)} disabled={!picked.includes(p.id) && picked.length >= 24} onChange={e => setPicked(old => e.target.checked ? [...old, p.id] : old.filter(id => id !== p.id))}/>{p.imageId && <img src={`/api/media/${p.imageId}`} alt="" className="size-12 rounded-lg object-cover"/>}<span className="min-w-0 flex-1 text-sm">{p.nameFa}<small className="mt-1 block text-slate-400">{p.sku}</small></span></label>)}{!foundProducts.length && <p className="p-5 text-center text-sm text-slate-500">محصولی پیدا نشد.</p>}</div><div className="mt-4 flex justify-between"><button className="btn-ghost" onClick={() => setPicked([])}>پاک کردن انتخاب‌ها</button><button className="btn-primary" onClick={() => { patch({ options: { ...active.options, productIds: picked } }); setModal(null); }}>تأیید انتخاب</button></div></BuilderDialog>}
  </div>;
}
