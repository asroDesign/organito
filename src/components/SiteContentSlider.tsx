"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import type { SitePageBlockItem } from "@/db/schema";

export function SiteContentSlider({ title, body, items, autoplay = false, interval = 5 }: { title: string; body?: string; items: SitePageBlockItem[]; autoplay?: boolean; interval?: number }) {
  const [index, setIndex] = useState(0), [paused, setPaused] = useState(false), [hover, setHover] = useState(false);
  const touch = useRef<number | null>(null);
  const active = items.length ? index % items.length : 0;
  const go = (delta: number) => setIndex(i => (i + delta + items.length) % items.length);
  useEffect(() => {
    if (!autoplay || paused || hover || items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => { if (!document.hidden) setIndex(i => (i + 1) % items.length); }, Math.max(3, interval) * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, paused, hover, items.length, interval]);
  if (!items.length) return null;
  const item = items[active];
  return <section aria-roledescription="اسلایدر" aria-label={title || "اسلایدهای فروشگاه"} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setHover(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHover(false); }} className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm" onKeyDown={e => { if (e.key === "ArrowLeft") { e.preventDefault(); go(1); } if (e.key === "ArrowRight") { e.preventDefault(); go(-1); } }}>
    <header className="flex items-center justify-between gap-3 p-5 sm:px-7"><div>{title && <h2 className="text-2xl font-black">{title}</h2>}{body && <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>}</div>{items.length > 1 && <div data-builder-interactive className="flex gap-2"><button type="button" className="btn-sm" aria-label="اسلاید قبلی" onClick={() => go(-1)}><ArrowRight className="size-4"/></button><button type="button" className="btn-sm" aria-label="اسلاید بعدی" onClick={() => go(1)}><ArrowLeft className="size-4"/></button>{autoplay && <button type="button" className="btn-sm" aria-label={paused ? "پخش خودکار" : "توقف پخش"} onClick={() => setPaused(!paused)}>{paused ? <Play className="size-4"/> : <Pause className="size-4"/>}</button>}</div>}</header>
    <article aria-live={autoplay && !paused ? "off" : "polite"} className="grid md:min-h-72 md:grid-cols-2" onTouchStart={e => { touch.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touch.current !== null && Math.abs(e.changedTouches[0].clientX - touch.current) > 50) go(e.changedTouches[0].clientX > touch.current ? 1 : -1); touch.current = null; }}>
      <div className="relative min-h-52 overflow-hidden bg-amber-100 md:order-2 md:min-h-80">{item.mediaId ? <img src={`/api/media/${item.mediaId}`} alt={item.caption || item.title} className="absolute inset-0 size-full object-cover"/> : <div className="grid h-full min-h-52 place-items-center bg-gradient-to-br from-yellow-200 to-orange-100 text-6xl text-amber-900">✦</div>}</div>
      <div className="flex flex-col justify-center p-6 sm:p-9"><h3 className="text-2xl font-black leading-relaxed">{item.title}</h3>{item.body && <p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-600">{item.body}</p>}{item.href && item.buttonLabel && <Link href={item.href} className="btn-primary mt-5 w-fit">{item.buttonLabel}<ArrowLeft className="size-4"/></Link>}{item.caption && <small className="mt-4 text-slate-500">{item.caption}</small>}</div>
    </article>
    <div data-builder-interactive className="flex justify-center gap-2 p-4">{items.map((it, i) => <button key={it.id || i} type="button" className={`h-3 rounded-full transition-all ${active === i ? "w-8 bg-amber-500" : "w-3 bg-slate-300"}`} aria-label={`اسلاید ${i + 1}`} aria-current={active === i} onClick={() => setIndex(i)} />)}</div>
  </section>;
}
