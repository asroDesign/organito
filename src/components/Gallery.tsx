"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Play, ZoomIn } from "lucide-react";
import { Modal } from "./Modal";

type Slide = { type: "image" | "video"; id: number };
const imageSrcSet = (id: number) => [320, 640, 960, 1280, 1600].map((width) => `/api/media/${id}?w=${width} ${width}w`).join(", ");

export function Gallery({ ids, alt, videoId, badge, actions }: { ids: number[]; alt: string; videoId?: number | null; badge?: string; actions?: ReactNode }) {
  const slides: Slide[] = [...ids.map((id) => ({ type: "image" as const, id })), ...(videoId ? [{ type: "video" as const, id: videoId }] : [])];
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touchStart = useRef<number | null>(null);
  const current = slides[index];
  const step = (direction: number) => setIndex((old) => (old + direction + slides.length) % slides.length);

  useEffect(() => {
    if (!zoom || slides.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [zoom, slides.length]);

  return (
    <div className="space-y-3">
      <div className="product-gallery-surface group relative aspect-square overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#f3efe2] to-white ring-1 ring-emerald-900/10">
        {!current ? <div className="grid h-full place-items-center text-7xl">🌿</div>
          : current.type === "video" ? <video key={current.id} src={`/api/media/${current.id}`} controls playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
          : <><img src={`/api/media/${current.id}?w=960`} srcSet={imageSrcSet(current.id)} sizes="(max-width: 1024px) 100vw, 50vw" alt={alt} decoding="async" className="h-full w-full cursor-zoom-in object-contain p-2 transition duration-300 group-hover:scale-[1.02]" onClick={() => setZoom(true)} />
            <button type="button" onClick={() => setZoom(true)} className="absolute bottom-3 left-3 rounded-full bg-white/95 p-2 text-slate-700 shadow transition hover:bg-white" aria-label="نمایش گالری تصاویر"><ZoomIn className="size-4" /></button></>}
        {badge && <span className="absolute right-3 top-3 z-10 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">{badge}</span>}
        {actions && <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">{actions}</div>}
        {slides.length > 1 && <>
          <button type="button" onClick={() => step(-1)} aria-label="تصویر قبلی" className="absolute right-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow transition hover:bg-white"><ChevronRight className="size-5" /></button>
          <button type="button" onClick={() => step(1)} aria-label="تصویر بعدی" className="absolute left-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow transition hover:bg-white"><ChevronLeft className="size-5" /></button>
        </>}
        {videoId && current?.type !== "video" && <button type="button" onClick={() => setIndex(slides.length - 1)} className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"><Play className="size-3.5 fill-white" />پخش ویدیو</button>}
      </div>

      {slides.length > 1 && <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="تصاویر محصول">
        {slides.map((slide, i) => <button key={`${slide.type}-${slide.id}`} type="button" aria-label={slide.type === "video" ? "ویدیوی محصول" : `تصویر ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} className={`relative size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${i === index ? "ring-emerald-500" : "opacity-70 ring-transparent hover:opacity-100"}`}>
          {slide.type === "video" ? <span className="grid h-full w-full place-items-center bg-slate-900 text-white"><Play className="size-6 fill-white" /></span>
            : <img src={`/api/media/${slide.id}?w=320`} alt={`${alt} ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
        </button>)}
        <span className="shrink-0 text-xs text-slate-500">{index + 1} از {slides.length}</span>
      </div>}

      {zoom && current && <Modal title={`${alt} · ${index + 1} از ${slides.length}`} onClose={() => setZoom(false)} wide>
        <div className="space-y-3">
          <div className="relative flex min-h-[45vh] items-center justify-center overflow-hidden rounded-2xl bg-slate-950 sm:min-h-[65vh]" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 45) step(end < touchStart.current ? 1 : -1); touchStart.current = null; }}>
            {current.type === "image" ? <img src={`/api/media/${current.id}`} alt={`${alt}، تصویر ${index + 1}`} className="max-h-[65vh] max-w-full object-contain sm:max-h-[72vh]" /> : <video src={`/api/media/${current.id}`} controls playsInline autoPlay className="max-h-[65vh] max-w-full sm:max-h-[72vh]" />}
            {slides.length > 1 && <><button type="button" onClick={() => step(-1)} aria-label="تصویر قبلی" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"><ChevronRight className="size-6" /></button><button type="button" onClick={() => step(1)} aria-label="تصویر بعدی" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"><ChevronLeft className="size-6" /></button></>}
          </div>
          {slides.length > 1 && <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">{slides.map((slide, i) => <button key={`modal-${slide.type}-${slide.id}`} type="button" onClick={() => setIndex(i)} aria-label={`نمایش مورد ${i + 1}`} className={`size-12 shrink-0 overflow-hidden rounded-lg ring-2 ${i === index ? "ring-emerald-500" : "ring-transparent opacity-65"}`}>{slide.type === "image" ? <img src={`/api/media/${slide.id}?w=320`} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center bg-slate-900 text-white"><Play className="size-4 fill-white" /></span>}</button>)}</div>}
          <p className="text-center text-xs text-slate-500">با کلیدهای جهت‌دار یا کشیدن تصویر، بین موارد جابه‌جا شوید.</p>
        </div>
      </Modal>}
    </div>
  );
}
