"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Images, Loader2, LogOut, Upload, X, Star, Pencil, RotateCcw, RotateCw, Check } from "lucide-react";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { Modal } from "./Modal";

export async function api<T = Record<string, unknown>>(url: string, method = "POST", data?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json", "x-csrf": "1" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "خطا در ارتباط با سرور");
  return j as T;
}
export const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/* ---------------- toast ---------------- */
type T = { id: number; msg: string; ok: boolean };
let toasts: T[] = [];
const subs = new Set<() => void>();
export function toast(msg: string, ok = true) {
  const t = { id: Date.now() + Math.random(), msg, ok };
  toasts = [...toasts, t];
  subs.forEach((s) => s());
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); subs.forEach((s) => s()); }, 3500);
}
export function Toaster() {
  const list = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => toasts, () => toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[100] flex flex-col gap-2">
      {list.map((t) => <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-3 text-sm text-white shadow-lg ${t.ok ? "bg-emerald-600" : "bg-rose-600"}`}>{t.msg}</div>)}
    </div>
  );
}

/* ---------------- action button ---------------- */
export function ActionButton({ url, data, method = "POST", children, confirm, className = "btn-primary", success = "انجام شد", prompt, promptKey, redirect }: {
  url: string; data?: Record<string, unknown>; method?: string; children: ReactNode; confirm?: string; className?: string; success?: string; prompt?: string; promptKey?: string; redirect?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [dialogError, setDialogError] = useState("");
  const run = async (payload: Record<string, unknown>, fromDialog = false) => {
    setBusy(true);
    setDialogError("");
    try {
      await api(url, method, payload);
      toast(success);
      setDialogOpen(false);
      if (redirect) router.push(redirect);
      router.refresh();
    } catch (e) {
      const message = (e as Error).message;
      if (fromDialog) setDialogError(message); else toast(message, false);
    } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" disabled={busy} className={className} onClick={() => {
        if (confirm || prompt) { setPromptValue(""); setDialogError(""); setDialogOpen(true); return; }
        void run({ ...(data ?? {}) });
      }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>
      {dialogOpen && <Modal title={prompt ? "تأیید و تکمیل اطلاعات" : "تأیید عملیات"} onClose={() => { if (!busy) setDialogOpen(false); }}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><AlertTriangle className="size-5" /></span>
            <p className="pt-1 text-sm leading-7">{confirm ?? "برای ادامه، اطلاعات خواسته‌شده را وارد کنید."}</p>
          </div>
          {prompt && <label className="block text-sm font-bold text-slate-700">{prompt}<textarea autoFocus required rows={3} className="input mt-2 min-h-24" value={promptValue} onChange={(e) => setPromptValue(e.target.value)} /></label>}
          {dialogError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{dialogError}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} className="btn-ghost" onClick={() => setDialogOpen(false)}>انصراف</button>
            <button type="button" disabled={busy || Boolean(prompt && !promptValue.trim())} className={className} onClick={() => void run({ ...(data ?? {}), ...(prompt ? { [promptKey ?? "note"]: promptValue.trim() } : {}) }, true)}>{busy && <Loader2 className="size-4 animate-spin" />}{children}</button>
          </div>
        </div>
      </Modal>}
    </>
  );
}

/* ---------------- generic form ---------------- */
export type Field = { name: string; label: string; type?: "text" | "number" | "textarea" | "select" | "password" | "checkbox" | "date" | "datetime-local"; options?: [string, string][]; required?: boolean; placeholder?: string; defaultValue?: string | number | boolean; half?: boolean };
export function JsonForm({ url, method = "POST", fields, submit = "ثبت", extra, onDone, redirectTo, resetOnDone = true, idempotent }: {
  url: string; method?: string; fields: Field[]; submit?: string; extra?: Record<string, unknown>; onDone?: (r: Record<string, unknown>) => void; redirectTo?: string | ((r: Record<string, unknown>) => string); resetOnDone?: boolean; idempotent?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const data: Record<string, unknown> = { ...(extra ?? {}) };
      for (const f of fields) {
        if (f.type === "checkbox") data[f.name] = fd.get(f.name) === "on";
        else { const v = fd.get(f.name); data[f.name] = f.type === "number" && v !== "" ? Number(v) : v; }
      }
      if (idempotent) data.idempotencyKey = uid();
      setBusy(true); setErr("");
      try {
        const r = await api<Record<string, unknown>>(url, method, data);
        toast("با موفقیت ثبت شد");
        if (resetOnDone) form.reset();
        onDone?.(r);
        if (redirectTo) router.push(typeof redirectTo === "string" ? redirectTo.replace(/:(\w+)/g, (_, k) => encodeURIComponent(String(r[k] ?? ""))) : redirectTo(r));
        router.refresh();
      } catch (e2) { setErr((e2 as Error).message); toast((e2 as Error).message, false); } finally { setBusy(false); }
    }}>
      {fields.map((f) => (
        <label key={f.name} className={`flex flex-col gap-1 text-sm ${f.half ? "col-span-2 sm:col-span-1" : "col-span-2"} ${f.type === "checkbox" ? "flex-row items-center gap-2" : ""}`}>
          {f.type !== "checkbox" && <span className="text-slate-600">{f.label}{f.required && <span className="text-rose-500"> *</span>}</span>}
          {f.type === "textarea" ? <textarea name={f.name} required={f.required} placeholder={f.placeholder} defaultValue={f.defaultValue as string} className="input min-h-24" />
            : f.type === "select" ? <select name={f.name} required={f.required} defaultValue={f.defaultValue as string} className="input">{f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            : f.type === "date" ? <JalaliDatePicker name={f.name} defaultValue={(f.defaultValue as string) ?? ""} allowEmpty={!f.required} />
            : f.type === "checkbox" ? <><input type="checkbox" name={f.name} defaultChecked={!!f.defaultValue} className="h-4 w-4" /><span>{f.label}</span></>
            : <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} defaultValue={f.defaultValue as string} className="input" dir={f.type === "number" ? "ltr" : undefined} />}
        </label>
      ))}
      {err && <div className="col-span-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{err}</div>}
      <div className="col-span-2"><button disabled={busy} className="btn-primary">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{submit}</button></div>
    </form>
  );
}

/* ---------------- uploader ---------------- */
export function ImageUploader({ value, onChange, max = 8, allowLibrary = true, folderSlug = "custom" }: { value: number[]; onChange: (ids: number[]) => void; max?: number; allowLibrary?: boolean; folderSlug?: "blog" | "products" | "custom" }) {
  const [busy, setBusy] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryUploadBusy, setLibraryUploadBusy] = useState(false);
  const [libraryEdit, setLibraryEdit] = useState<{ id: number; filename: string; rotation: number; ratio: "original" | "1:1" | "4:3" | "16:9" } | null>(null);
  const [libraryEditBusy, setLibraryEditBusy] = useState(false);
  const [libraryFolders, setLibraryFolders] = useState<{ id: number; name: string; slug: string; parentId: number | null }[]>([]);
  const [destinationFolder, setDestinationFolder] = useState("default");
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState<{ id: number; filename: string; alt: string | null; mime?: string; size?: number }[]>([]);
  const openLibrary = async () => {
    setLibraryOpen(true); setLibraryBusy(true);
    try {
      const [files, folders] = await Promise.all([
        api<{ id: number; filename: string; alt: string | null }[]>("/api/media/library?type=image", "GET"),
        api<{ id: number; name: string; slug: string; parentId: number | null }[]>("/api/media/folders", "GET"),
      ]);
      setLibrary(files); setLibraryFolders(folders); setDestinationFolder("default");
    }
    catch (e) { toast((e as Error).message, false); setLibraryOpen(false); }
    finally { setLibraryBusy(false); }
  };
  function setUploadDestination(form: FormData) {
    if (destinationFolder === "default") form.append("folderSlug", folderSlug);
    else if (destinationFolder === "none") form.append("folderSlug", "none");
    else form.append("folderId", destinationFolder);
  }
  async function uploadToLibrary(files: FileList | null) {
    if (!files?.length) return;
    setLibraryUploadBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append("file", file); fd.append("kind", "editor"); setUploadDestination(fd);
        const response = await fetch("/api/media", { method: "POST", headers: { "x-csrf": "1" }, body: fd });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "خطا در بارگذاری فایل");
      }
      setLibrary(await api<{ id: number; filename: string; alt: string | null; mime?: string; size?: number }[]>("/api/media/library?type=image", "GET"));
      setLibraryFolders(await api<{ id: number; name: string; slug: string; parentId: number | null }[]>("/api/media/folders", "GET"));
      toast("تصویر در مرکز فایل بارگذاری شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setLibraryUploadBusy(false); if (libraryInputRef.current) libraryInputRef.current.value = ""; }
  }
  async function saveLibraryEdit() {
    if (!libraryEdit) return;
    setLibraryEditBusy(true);
    try {
      const image = new Image(); image.src = `/api/media/${libraryEdit.id}`;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("بارگذاری تصویر برای ویرایش ناموفق بود")); });
      const radians = libraryEdit.rotation * Math.PI / 180;
      const rotatedWidth = Math.abs(image.width * Math.cos(radians)) + Math.abs(image.height * Math.sin(radians));
      const rotatedHeight = Math.abs(image.width * Math.sin(radians)) + Math.abs(image.height * Math.cos(radians));
      const targetRatio = libraryEdit.ratio === "original" ? rotatedWidth / rotatedHeight : libraryEdit.ratio === "1:1" ? 1 : libraryEdit.ratio === "4:3" ? 4 / 3 : 16 / 9;
      let width = rotatedWidth, height = rotatedHeight;
      if (width / height > targetRatio) width = height * targetRatio; else height = width / targetRatio;
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d"); if (!context) throw new Error("ویرایش تصویر در این مرورگر در دسترس نیست");
      context.translate(canvas.width / 2, canvas.height / 2); context.rotate(radians); context.drawImage(image, -image.width / 2, -image.height / 2);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("ساخت تصویر ویرایش‌شده ناموفق بود")), "image/webp", 0.9));
      const filename = `${libraryEdit.filename.replace(/\.[^.]+$/, "")}-edited.webp`;
      const form = new FormData(); form.append("file", new File([blob], filename, { type: "image/webp" })); form.append("kind", "editor"); setUploadDestination(form);
      const response = await fetch("/api/media", { method: "POST", headers: { "x-csrf": "1" }, body: form }); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "ذخیره تصویر ویرایش‌شده ناموفق بود");
      setLibrary(await api<{ id: number; filename: string; alt: string | null; mime?: string; size?: number }[]>("/api/media/library?type=image", "GET"));
      setLibraryFolders(await api<{ id: number; name: string; slug: string; parentId: number | null }[]>("/api/media/folders", "GET"));
      onChange([...value, result.id]); setLibraryEdit(null); toast("نسخه ویرایش‌شده در مرکز فایل ذخیره و به گالری اضافه شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setLibraryEditBusy(false); }
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    const ids = [...value];
    for (const f of Array.from(files).slice(0, max - ids.length)) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("folderSlug", folderSlug);
      const r = await fetch("/api/media", { method: "POST", body: fd, headers: { "x-csrf": "1" } });
      const j = await r.json();
      if (r.ok) ids.push(j.id); else toast(j.error ?? "خطای آپلود", false);
    }
    onChange(ids);
    setBusy(false);
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id, i) => (
          <div key={id} className={`relative h-24 w-24 overflow-hidden rounded-xl border-2 ${i === 0 ? "border-emerald-500" : "border-slate-200"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${id}`} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="absolute left-1 top-1 rounded-full bg-white/90 p-0.5"><X className="h-3 w-3" /></button>
            {i !== 0 ? <button type="button" title="تصویر اصلی" onClick={() => onChange([id, ...value.filter((x) => x !== id)])} className="absolute bottom-1 left-1 rounded-full bg-white/90 p-0.5"><Star className="h-3 w-3" /></button>
              : <span className="absolute bottom-0 right-0 left-0 bg-emerald-500 text-center text-[10px] text-white">اصلی</span>}
          </div>
        ))}
        {value.length < max && (
          <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-500">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      {allowLibrary && value.length < max && <button type="button" onClick={openLibrary} className="btn-ghost"><Images className="h-4 w-4" />انتخاب از مرکز فایل</button>}
      <p className="text-xs text-slate-400">فقط آپلود فایل از دستگاه شما — JPG، PNG و WebP تا ۳ مگابایت. ستاره = تصویر اصلی.</p>
      {allowLibrary && libraryOpen && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !libraryEditBusy) setLibraryOpen(false); }}><div className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><b className="block">انتخاب از مرکز فایل</b><small className="text-slate-500">تصویر موجود را انتخاب یا ویرایش کنید، یا فایل تازه بارگذاری کنید.</small></div><div className="flex items-center gap-2"><label className="btn-primary cursor-pointer">{libraryUploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}بارگذاری تصویر<input ref={libraryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => uploadToLibrary(e.target.files)} /></label><button type="button" onClick={() => setLibraryOpen(false)} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div></div><label className="mb-4 block max-w-sm text-sm">پوشه مقصد فایل‌های تازه و نسخه ویرایش‌شده<select className="input mt-1" value={destinationFolder} onChange={e => setDestinationFolder(e.target.value)}><option value="default">پوشه پیش‌فرض این بخش ({folderSlug === "blog" ? "وبلاگ" : folderSlug === "products" ? "محصولات" : "سفارشی"})</option>{libraryFolders.filter(folder => folder.slug !== folderSlug).map(folder => <option key={folder.id} value={String(folder.id)}>{folder.name}</option>)}</select></label>{libraryEdit ? <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-[minmax(0,1fr)_240px]"><div className="grid min-h-56 place-items-center overflow-hidden rounded-2xl bg-slate-100 p-3"><img src={`/api/media/${libraryEdit.id}`} alt={libraryEdit.filename} className="max-h-[48vh] max-w-full object-cover" style={{ transform: `rotate(${libraryEdit.rotation}deg)`, aspectRatio: libraryEdit.ratio === "original" ? undefined : libraryEdit.ratio === "1:1" ? "1 / 1" : libraryEdit.ratio === "4:3" ? "4 / 3" : "16 / 9" }} /></div><div className="space-y-3"><b className="block">ویرایش تصویر</b><label className="block text-sm">نسبت برش<select className="input mt-1" value={libraryEdit.ratio} onChange={e => setLibraryEdit({...libraryEdit,ratio:e.target.value as typeof libraryEdit.ratio})}><option value="original">نسبت اصلی</option><option value="1:1">مربع ۱:۱</option><option value="4:3">افقی ۴:۳</option><option value="16:9">عریض ۱۶:۹</option></select></label><div className="flex gap-2"><button type="button" className="btn-ghost flex-1" onClick={() => setLibraryEdit({...libraryEdit,rotation:(libraryEdit.rotation+270)%360})}><RotateCcw className="size-4"/>چرخش چپ</button><button type="button" className="btn-ghost flex-1" onClick={() => setLibraryEdit({...libraryEdit,rotation:(libraryEdit.rotation+90)%360})}><RotateCw className="size-4"/>چرخش راست</button></div><p className="text-xs leading-6 text-slate-500">نسخه ویرایش‌شده به‌صورت فایل جدید ذخیره می‌شود و تصویر اصلی دست‌نخورده می‌ماند.</p><div className="flex gap-2"><button type="button" className="btn-ghost flex-1" onClick={() => setLibraryEdit(null)}>بازگشت</button><button type="button" disabled={libraryEditBusy || value.length >= max} className="btn-primary flex-1" onClick={() => void saveLibraryEdit()}>{libraryEditBusy?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}ذخیره و انتخاب</button></div></div></div> : libraryBusy ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">{library.map((file) => <div key={file.id} className={`overflow-hidden rounded-xl border ${value.includes(file.id) ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"}`}><button type="button" disabled={value.includes(file.id)||value.length>=max} onClick={() => { if (!value.includes(file.id) && value.length < max) onChange([...value, file.id]); }} className="block w-full text-right disabled:cursor-default"><img src={`/api/media/${file.id}`} alt={file.alt ?? file.filename} className="aspect-square w-full bg-slate-100 object-cover" loading="lazy" /><span className="block truncate p-2 text-[11px]">{file.filename}</span></button><div className="flex justify-end border-t p-1"><button type="button" disabled={value.length >= max} onClick={() => setLibraryEdit({id:file.id,filename:file.filename,rotation:0,ratio:"original"})} className="btn-ghost px-2 py-1 text-xs disabled:opacity-50"><Pencil className="size-3"/>ویرایش تصویر</button></div></div>)}</div>}{library.length===0&&!libraryBusy&&<p className="py-10 text-center text-sm text-slate-500">تصویری در مرکز فایل نیست؛ با دکمهٔ «بارگذاری تصویر» فایل اضافه کنید.</p>}</div></div>}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50" onClick={async () => { await api("/api/auth/logout"); router.push("/login"); router.refresh(); }}><LogOut className="h-4 w-4" />خروج</button>;
}

/* ---------------- cart (localStorage only for temp cart) ---------------- */
export type CartItem = { productId: number; offerId: number | null; variantId: number | null; qty: number; title: string; seller?: string; selectedOptions?: Record<string, string | string[]> };
const KEY = "yt_cart_v1";
const cartSubs = new Set<() => void>();
let cartCache: CartItem[] | null = null;
function readCart(): CartItem[] {
  if (cartCache) return cartCache;
  try { cartCache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cartCache = []; }
  return cartCache!;
}
export function writeCart(items: CartItem[]) {
  cartCache = items;
  localStorage.setItem(KEY, JSON.stringify(items));
  cartSubs.forEach((s) => s());
}
const EMPTY: CartItem[] = [];
export function useCart() {
  return useSyncExternalStore((cb) => { cartSubs.add(cb); return () => cartSubs.delete(cb); }, readCart, () => EMPTY);
}
export function addToCart(item: CartItem) {
  const items = [...readCart()];
  const i = items.findIndex((x) => x.productId === item.productId && x.offerId === item.offerId && x.variantId === item.variantId && JSON.stringify(x.selectedOptions ?? {}) === JSON.stringify(item.selectedOptions ?? {}));
  if (i >= 0) items[i] = { ...items[i], qty: Math.min(100, items[i].qty + item.qty) }; else items.push(item);
  writeCart(items);
  toast("به سبد خرید اضافه شد");
}
export function CartCount() {
  const c = useCart();
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  const n = c.reduce((a, b) => a + b.qty, 0);
  if (!m || !n) return null;
  return <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{n.toLocaleString("fa-IR")}</span>;
}
