"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Heart, X } from "lucide-react";
import { api } from "./client";
import { Img } from "./ui";

type Story = { id: number; title: string; caption: string | null; mediaId: number; mediaType: "image" | "video"; productName: string | null; productSlug: string | null; href: string | null; ctaLabel: string | null; viewCount: number; likeCount: number };
type StoryStats = { views: number; likes: number; liked: boolean };
const VISITOR_KEY = "organo-story-visitor-v1";
function visitorKey() {
  try {
    let value = localStorage.getItem(VISITOR_KEY);
    if (!value) { value = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`; localStorage.setItem(VISITOR_KEY, value); }
    return value;
  } catch { return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`; }
}

export function StoryRail({ stories }: { stories: Story[] }) {
  const [active, setActive] = useState<number | null>(null), [stats, setStats] = useState<Record<number, StoryStats>>({}), [liking, setLiking] = useState(false);
  const current = active === null ? null : stories[active];
  const activeStoryId = current?.id, activeMediaType = current?.mediaType;
  const close = useCallback(() => setActive(null), []);
  const move = useCallback((direction: number) => setActive((value) => value === null ? null : Math.max(0, Math.min(stories.length - 1, value + direction))), [stories.length]);

  useEffect(() => {
    if (activeStoryId === undefined) return;
    const key = visitorKey();
    void api<StoryStats>(`/api/stories/${activeStoryId}/interaction`, "POST", { action: "view", visitorKey: key }).then((result) => setStats((old) => ({ ...old, [activeStoryId]: result }))).catch(() => {});
    if (activeMediaType !== "image") return;
    const timer = window.setTimeout(() => move(1), 6500);
    return () => window.clearTimeout(timer);
  }, [active, activeStoryId, activeMediaType, move]);
  useEffect(() => {
    if (active === null) return;
    const oldOverflow = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (event.key === "ArrowLeft") move(1); if (event.key === "ArrowRight") move(-1); };
    document.body.style.overflow = "hidden"; window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", onKey); };
  }, [active, close, move]);

  if (!stories.length) return null;
  const like = async () => {
    if (!current || liking) return;
    setLiking(true);
    try { const result = await api<StoryStats>(`/api/stories/${current.id}/interaction`, "POST", { action: "toggle_like", visitorKey: visitorKey() }); setStats((old) => ({ ...old, [current.id]: result })); }
    catch { /* Story viewing stays usable if interaction tracking is temporarily unavailable. */ }
    finally { setLiking(false); }
  };
  const href = current?.href || (current?.productSlug ? `/products/${current.productSlug}` : null);

  return <>
    <section aria-label="استوری‌های فروشگاه" className="mx-auto max-w-7xl px-4 pb-3 pt-5 sm:pt-7"><div className="mb-3 flex items-end justify-between"><div><h2 className="font-black text-slate-900">تازه‌های فروشگاه</h2><p className="mt-1 text-xs text-slate-500">داستان محصول‌ها و تولیدکننده‌ها</p></div><span className="text-[10px] text-slate-400">برای تماشا انتخاب کنید</span></div><div className="flex gap-4 overflow-x-auto pb-2">{stories.map((story, index) => <button type="button" key={story.id} onClick={() => setActive(index)} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center sm:w-[88px]"><span className="rounded-full bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 p-[3px] shadow-sm transition group-hover:scale-105"><span className="grid size-[66px] place-items-center overflow-hidden rounded-full border-[3px] border-white bg-emerald-50 sm:size-[76px]">{story.mediaType === "image" ? <Img id={story.mediaId} alt={story.title} className="size-full object-cover"/> : <span className="relative size-full"><video src={`/api/media/${story.mediaId}`} preload="metadata" muted className="size-full object-cover"/><span className="absolute inset-0 grid place-items-center bg-black/15 text-lg text-white">▶</span></span>}</span></span><span className="line-clamp-2 w-full text-[11px] font-bold leading-4 text-slate-700">{story.title}</span></button>)}</div></section>
    {current && active !== null && <div role="dialog" aria-modal="true" aria-label={`استوری ${current.title}`} dir="rtl" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-0 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="relative h-[100dvh] w-full max-w-[440px] overflow-hidden bg-slate-950 sm:h-[min(88dvh,850px)] sm:rounded-[2rem] sm:shadow-2xl" onTouchStart={(event) => { const x = event.touches[0]?.clientX; if (x !== undefined) event.currentTarget.dataset.touchX = String(x); }} onTouchEnd={(event) => { const startX = Number(event.currentTarget.dataset.touchX); const endX = event.changedTouches[0]?.clientX; if (Number.isFinite(startX) && endX !== undefined && Math.abs(startX - endX) > 55) move(startX > endX ? 1 : -1); }}>
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">{stories.map((story, index) => <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">{index < active ? <span className="block h-full bg-white"/> : index === active && story.mediaType === "image" ? <span className="story-progress block h-full bg-white"/> : null}</span>)}</div>
        <button type="button" onClick={close} aria-label="بستن استوری" className="absolute left-3 top-7 z-30 grid size-10 place-items-center rounded-full bg-black/35 text-white"><X className="size-5"/></button>
        <div className="absolute right-3 top-7 z-30 flex items-center gap-2 rounded-full bg-black/35 px-3 py-2 text-xs text-white"><span className="max-w-56 truncate font-bold">{current.title}</span></div>
        <div className="absolute inset-0 flex items-center justify-center">{current.mediaType === "image" ? <Img id={current.mediaId} alt={current.title} className="size-full object-contain"/> : <video key={current.id} src={`/api/media/${current.mediaId}`} autoPlay muted playsInline onEnded={() => move(1)} className="size-full object-contain"/>}</div>
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 text-white">{current.caption && <p className="mb-3 text-sm leading-6">{current.caption}</p>}{current.productName && <p className="mb-3 text-xs text-white/75">محصول: {current.productName}</p>}<div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex items-center gap-1 text-xs text-white/80"><Eye className="size-4"/>{(stats[current.id]?.views ?? current.viewCount).toLocaleString("fa-IR")}</span><button type="button" onClick={() => void like()} disabled={liking} aria-label={stats[current.id]?.liked ? "پسندیدن را بردار" : "پسندیدن استوری"} aria-pressed={stats[current.id]?.liked ?? false} className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm ${stats[current.id]?.liked ? "bg-rose-500 text-white" : "bg-white/15 text-white"}`}><Heart className={`size-4 ${stats[current.id]?.liked ? "fill-current" : ""}`}/>{(stats[current.id]?.likes ?? current.likeCount).toLocaleString("fa-IR")}</button></div>{href && <a href={href} target={/^https?:\/\//i.test(href) ? "_blank" : undefined} rel={/^https?:\/\//i.test(href) ? "noopener noreferrer" : undefined} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-amber-950">{current.ctaLabel || "مشاهده"}</a>}</div></div>
        {active > 0 && <button type="button" onClick={() => move(-1)} aria-label="استوری قبلی" className="absolute right-1 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/20 text-white"><ChevronRight className="size-6"/></button>}{active < stories.length - 1 && <button type="button" onClick={() => move(1)} aria-label="استوری بعدی" className="absolute left-1 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/20 text-white"><ChevronLeft className="size-6"/></button>}
      </div>
      <style>{`@keyframes story-progress{from{width:0}to{width:100%}}.story-progress{animation:story-progress 6.5s linear forwards}`}</style>
    </div>}
  </>;
}
