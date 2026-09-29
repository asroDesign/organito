"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, X, Clock, FolderOpen, Tag, ArrowLeft, TrendingUp } from "lucide-react";

type P = { id: number; slug: string; name: string; brand: string; imageId: number | null; price: number; compareAt: number; inStock: boolean; category: string | null; discountPct: number };
type R = { total: number; products: P[]; categories: { id: number; name: string }[]; brands: string[] };
const KEY = "sb_recent_search";
const fa = (n: number) => n.toLocaleString("fa-IR");

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-lime-200 px-0.5 text-emerald-950">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export function LiveSearch({ popular = [], compact }: { popular?: string[]; compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<R | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(null); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.current.signal }); if (r.ok) { setRes(await r.json()); setActive(-1); } }
      catch { /* aborted */ } finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const remember = (term: string) => { const next = [term, ...recent.filter((x) => x !== term)].slice(0, 6); setRecent(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const go = (term: string) => { const t = term.trim(); if (!t) return; remember(t); setOpen(false); router.push(`/shop?q=${encodeURIComponent(t)}`); };
  const items = res?.products ?? [];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && items[active]) { remember(q.trim()); setOpen(false); router.push(`/products/${items[active].slug}`); } else go(q); }
  };
  const term = q.trim();
  return (
    <div ref={box} className="relative w-full">
      <div className={`relative flex items-center rounded-2xl bg-white ring-1 transition ${open ? "shadow-xl ring-emerald-300" : "ring-emerald-900/10"}`}>
        <Search className="absolute right-4 h-5 w-5 text-emerald-700/60" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} placeholder="جست‌وجو در عسل، روغن، زعفران، خشکبار…" aria-label="جست‌وجو"
          className={`w-full bg-transparent pr-12 pl-24 text-sm outline-none ${compact ? "h-11" : "h-12"}`} />
        {busy ? <Loader2 className="absolute left-24 h-4 w-4 animate-spin text-emerald-600" /> : q && <button onClick={() => { setQ(""); setRes(null); }} className="absolute left-24 text-slate-400" aria-label="پاک کردن"><X className="h-4 w-4" /></button>}
        <button onClick={() => go(q)} className="absolute left-1.5 h-9 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">جست‌وجو</button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[75vh] overflow-y-auto rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-emerald-900/10">
          {term.length < 2 ? (
            <div className="space-y-4 p-2 text-sm">
              {recent.length > 0 && <div><div className="mb-2 flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />جست‌وجوهای اخیر</span><button onClick={() => { setRecent([]); localStorage.removeItem(KEY); }} className="text-rose-500">پاک کردن</button></div><div className="flex flex-wrap gap-1.5">{recent.map((r) => <button key={r} onClick={() => { setQ(r); }} className="rounded-full bg-slate-100 px-3 py-1 text-xs hover:bg-emerald-50">{r}</button>)}</div></div>}
              {popular.length > 0 && <div><div className="mb-2 flex items-center gap-1 text-xs text-slate-500"><TrendingUp className="h-3.5 w-3.5" />پرجست‌وجوها</div><div className="flex flex-wrap gap-1.5">{popular.map((r) => <button key={r} onClick={() => setQ(r)} className="rounded-full bg-lime-50 px-3 py-1 text-xs text-lime-800 ring-1 ring-lime-200 hover:bg-lime-100">{r}</button>)}</div></div>}
              {!recent.length && !popular.length && <p className="text-center text-xs text-slate-400">حداقل ۲ حرف تایپ کنید…</p>}
            </div>
          ) : !res && busy ? (
            <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <div key={i} className="flex gap-3"><div className="skeleton h-14 w-14" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3" /></div></div>)}</div>
          ) : res && !items.length && !res.categories.length && !res.brands.length ? (
            <div className="p-6 text-center text-sm text-slate-500">نتیجه‌ای برای «{term}» پیدا نشد.<Link href={`/customer/supply?pn=${encodeURIComponent(term)}`} onClick={() => setOpen(false)} className="mt-2 block font-bold text-emerald-700">ثبت سفارش ویژه این محصول ←</Link></div>
          ) : res && (
            <div className="space-y-3">
              {(res.categories.length > 0 || res.brands.length > 0) && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  {res.categories.map((c) => <Link key={c.id} href={`/shop?cat=${c.id}`} onClick={() => setOpen(false)} className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 ring-1 ring-amber-200"><FolderOpen className="h-3 w-3" />{c.name}</Link>)}
                  {res.brands.map((b) => <Link key={b} href={`/shop?brand=${encodeURIComponent(b)}`} onClick={() => setOpen(false)} className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800 ring-1 ring-emerald-200"><Tag className="h-3 w-3" />{b}</Link>)}
                </div>
              )}
              <ul>
                {items.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/products/${p.slug}`} onClick={() => { remember(term); setOpen(false); }} onMouseEnter={() => setActive(i)} className={`flex items-center gap-3 rounded-2xl p-2 transition ${active === i ? "bg-emerald-50" : ""}`}>
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f3efe2]">{p.imageId ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/media/${p.imageId}`} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center">🌿</span>}</span>
                      <span className="min-w-0 flex-1"><b className="line-clamp-1 text-sm text-emerald-950"><Highlight text={p.name} q={term} /></b><span className="text-[11px] text-slate-500">{p.brand}{p.category ? ` · ${p.category}` : ""}</span></span>
                      <span className="text-left">{p.inStock ? <><b className="block text-sm">{fa(p.price)} <span className="text-[10px] font-normal">ت</span></b>{p.discountPct > 0 && <span className="rounded bg-rose-500 px-1 text-[10px] text-white">{fa(p.discountPct)}٪</span>}</> : <span className="text-[11px] text-rose-500">ناموجود</span>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {res.total > items.length && <button onClick={() => go(q)} className="flex w-full items-center justify-center gap-1 rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white">مشاهده همه {fa(res.total)} نتیجه<ArrowLeft className="h-4 w-4" /></button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
