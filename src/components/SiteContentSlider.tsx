"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { SitePageBlockItem } from "@/db/schema";

export function SiteContentSlider({ title, body, items }: { title: string; body?: string; items: SitePageBlockItem[] }) {
  const slides = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const go = (index: number) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    slides.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };
  if (!items.length) return null;
  return <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
    <header className="flex items-center justify-between gap-3 p-5 sm:px-7"><div><h2 className="text-xl font-black text-emerald-950 sm:text-2xl">{title}</h2>{body && <p className="mt-1 text-sm leading-7 text-slate-600">{body}</p>}</div><div className="flex shrink-0 gap-2"><button type="button" aria-label="اسلاید قبلی" onClick={() => go(active - 1)} className="grid size-10 place-items-center rounded-full border border-amber-200 text-amber-800 hover:bg-amber-50"><ArrowRight className="size-4"/></button><button type="button" aria-label="اسلاید بعدی" onClick={() => go(active + 1)} className="grid size-10 place-items-center rounded-full border border-amber-200 text-amber-800 hover:bg-amber-50"><ArrowLeft className="size-4"/></button></div></header>
    <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth" dir="rtl">{items.map((item, index) => <article key={index} ref={(node) => { slides.current[index] = node; }} onMouseEnter={() => setActive(index)} className="grid w-full shrink-0 snap-start md:min-h-72 md:grid-cols-2">
      <div className="relative min-h-48 overflow-hidden bg-amber-100 md:order-2 md:min-h-72">{item.mediaId ? <img src={"/api/media/" + item.mediaId} alt={item.caption || item.title} className="absolute inset-0 size-full object-cover"/> : <div className="grid h-full min-h-48 place-items-center bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-100 text-amber-900"><span className="text-6xl">✦</span></div>}{item.caption && <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-700">{item.caption}</span>}</div>
      <div className="flex flex-col justify-center p-6 sm:p-9 md:order-1"><span className="mb-3 text-xs font-bold text-amber-700">پیشنهاد ویژه</span><h3 className="text-2xl font-black leading-relaxed text-emerald-950">{item.title}</h3>{item.body && <p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-600">{item.body}</p>}{item.buttonLabel && item.href && <Link href={item.href} className="btn-primary mt-5 w-fit">{item.buttonLabel}<ArrowLeft className="size-4"/></Link>}</div>
    </article>)}</div>
    <div className="flex justify-center gap-2 pb-4">{items.map((_, index) => <button key={index} type="button" onClick={() => go(index)} aria-label={"رفتن به اسلاید " + (index + 1)} className={"h-2.5 rounded-full transition-all " + (active === index ? "w-7 bg-amber-500" : "w-2.5 bg-slate-300")}/>)}</div>
  </section>;
}
