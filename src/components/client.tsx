"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Images, Loader2, LogOut, Upload, X, Star } from "lucide-react";
import { JalaliDatePicker } from "./JalaliDatePicker";

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
  return (
    <button type="button" disabled={busy} className={className} onClick={async () => {
      if (confirm && !window.confirm(confirm)) return;
      let payload = { ...(data ?? {}) };
      if (prompt) {
        const v = window.prompt(prompt);
        if (v === null) return;
        payload = { ...payload, [promptKey ?? "note"]: v };
      }
      setBusy(true);
      try {
        await api(url, method, payload);
        toast(success);
        if (redirect) router.push(redirect);
        router.refresh();
      } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
    }}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
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
export function ImageUploader({ value, onChange, max = 8, allowLibrary = true }: { value: number[]; onChange: (ids: number[]) => void; max?: number; allowLibrary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [library, setLibrary] = useState<{ id: number; filename: string; alt: string | null }[]>([]);
  const openLibrary = async () => {
    setLibraryOpen(true); setLibraryBusy(true);
    try { setLibrary(await api<{ id: number; filename: string; alt: string | null }[]>("/api/media/library?type=image", "GET")); }
    catch (e) { toast((e as Error).message, false); setLibraryOpen(false); }
    finally { setLibraryBusy(false); }
  };
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    const ids = [...value];
    for (const f of Array.from(files).slice(0, max - ids.length)) {
      const fd = new FormData();
      fd.append("file", f);
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
      {allowLibrary && libraryOpen && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setLibraryOpen(false); }}><div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"><div className="mb-4 flex items-center justify-between"><div><b className="block">انتخاب از مرکز فایل</b><small className="text-slate-500">با انتخاب هر تصویر، به گالری این بخش افزوده می‌شود.</small></div><button type="button" onClick={() => setLibraryOpen(false)} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{libraryBusy ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">{library.map((file) => <button type="button" key={file.id} disabled={value.includes(file.id)} onClick={() => { if (!value.includes(file.id) && value.length < max) onChange([...value, file.id]); }} className={`overflow-hidden rounded-xl border text-right ${value.includes(file.id) ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-400"}`}><img src={`/api/media/${file.id}`} alt={file.alt ?? file.filename} className="aspect-square w-full bg-slate-100 object-cover" loading="lazy" /><span className="block truncate p-2 text-[11px]">{file.filename}</span></button>)}</div>}</div></div>}
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
