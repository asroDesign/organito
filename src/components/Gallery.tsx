"use client";
import { useState } from "react";
import { Play, ZoomIn, X } from "lucide-react";

type Slide = { type: "image" | "video"; id: number };

export function Gallery({ ids, alt, videoId, badge }: { ids: number[]; alt: string; videoId?: number | null; badge?: string }) {
  const slides: Slide[] = [...ids.map((id) => ({ type: "image" as const, id })), ...(videoId ? [{ type: "video" as const, id: videoId }] : [])];
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const cur = slides[i];
  return (
    <div className="space-y-3">
      <div className="group relative aspect-square overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#f3efe2] to-white ring-1 ring-emerald-900/10">
        {!cur ? <div className="grid h-full place-items-center text-7xl">🌿</div>
          : cur.type === "video" ? <video key={cur.id} src={`/api/media/${cur.id}`} controls autoPlay muted playsInline preload="metadata" className="h-full w-full bg-black object-contain" />
          : <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${cur.id}`} alt={alt} className="h-full w-full cursor-zoom-in object-cover transition duration-500 group-hover:scale-105" onClick={() => setZoom(true)} />
            <button onClick={() => setZoom(true)} className="absolute bottom-3 left-3 rounded-full bg-white/90 p-2 text-slate-700 shadow opacity-0 transition group-hover:opacity-100" aria-label="بزرگ‌نمایی"><ZoomIn className="h-4 w-4" /></button></>}
        {badge && <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">{badge}</span>}
        {videoId && cur?.type !== "video" && <button onClick={() => setI(slides.length - 1)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"><Play className="h-3.5 w-3.5 fill-white" />پخش ویدیو</button>}
      </div>
      {slides.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, k) => (
            <button key={`${s.type}${s.id}`} onClick={() => setI(k)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 transition ${k === i ? "ring-emerald-500" : "opacity-70 ring-transparent hover:opacity-100"}`}>
              {s.type === "video" ? <span className="grid h-full w-full place-items-center bg-slate-900 text-white"><Play className="h-6 w-6 fill-white" /></span>
                : /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/media/${s.id}`} alt="" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}
      {zoom && cur?.type === "image" && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/90 p-4" onClick={() => setZoom(false)}>
          <button className="absolute left-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="بستن"><X className="h-6 w-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${cur.id}`} alt={alt} className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
