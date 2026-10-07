"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronLeft, Menu, X } from "lucide-react";
export type PublicMenuItem = { id: number; label: string; href: string | null; targetBlank: boolean; children: PublicMenuItem[] };

function MenuLink({ item, className = "" }: { item: PublicMenuItem; className?: string }) {
  if (!item.href) return <span className={className}>{item.label}</span>;
  if (/^https:\/\//i.test(item.href)) return <a href={item.href} target={item.targetBlank ? "_blank" : undefined} rel={item.targetBlank ? "noopener noreferrer" : undefined} className={className}>{item.label}</a>;
  return <Link href={item.href} target={item.targetBlank ? "_blank" : undefined} rel={item.targetBlank ? "noopener noreferrer" : undefined} className={className}>{item.label}</Link>;
}

function DesktopItem({ item }: { item: PublicMenuItem }) {
  return <div className="group relative"><MenuLink item={item} className="flex items-center gap-1 rounded-lg px-3 py-3 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"/>
    {item.children.length > 0 && <><span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-slate-400"><ChevronDown className="size-3"/></span><div className="invisible absolute right-0 top-full z-50 min-w-52 translate-y-2 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">{item.children.map((child) => <DesktopSubItem key={child.id} item={child}/>)}</div></>}
  </div>;
}

function DesktopSubItem({ item }: { item: PublicMenuItem }) {
  return <div className="group/sub relative"><MenuLink item={item} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"/>{item.children.length > 0 && <><ChevronLeft className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-slate-400"/><div className="invisible absolute right-full top-0 z-50 min-w-48 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover/sub:visible group-hover/sub:opacity-100 group-focus-within/sub:visible group-focus-within/sub:opacity-100">{item.children.map((child) => <DesktopSubItem key={child.id} item={child}/>)}</div></>}</div>;
}

export function SiteNavMenus({ headerItems, mobileItems, fallbackItems, mode = "all", showMobile = true }: { headerItems: PublicMenuItem[]; mobileItems: PublicMenuItem[]; fallbackItems: PublicMenuItem[]; mode?: "all" | "mobileOnly" | "desktopOnly"; showMobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const mobile = mobileItems.length ? mobileItems : headerItems.length ? headerItems : fallbackItems;
  return <>
    {mode !== "mobileOnly" && <div className="hidden items-center md:flex">{headerItems.length ? headerItems.map((item) => <DesktopItem key={item.id} item={item}/>) : fallbackItems.map((item) => <DesktopItem key={item.id} item={item}/>)}</div>}
    {mode !== "desktopOnly" && showMobile && <>
    <div className="relative md:hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-sm text-slate-700" aria-expanded={open} aria-label={open ? "بستن منوی سایت" : "بازکردن منوی سایت"}>{open ? <X className="size-5"/> : <Menu className="size-5"/>}<span>منو</span></button>
      {open && <div role="navigation" aria-label="منوی موبایل" className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-[min(90vw,24rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl">{mobile.map((item) => <MobileItem key={item.id} item={item} close={() => setOpen(false)} depth={0}/>)}</div>}
    </div>
    </>}
  </>;
}

function MobileItem({ item, close, depth }: { item: PublicMenuItem; close: () => void; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="border-b border-slate-100 last:border-0" style={{ marginRight: depth * 14 }}><div className="flex items-center justify-between gap-2 py-2.5">{item.href ? <span onClick={close} className="flex-1"><MenuLink item={item} className="block text-sm font-medium text-slate-700"/></span> : <b className="text-sm text-slate-800">{item.label}</b>}{item.children.length > 0 && <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={`نمایش زیرمنوی ${item.label}`} className="rounded-lg p-1 text-slate-500"><ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`}/></button>}</div>{expanded && item.children.map((child) => <MobileItem key={child.id} item={child} close={close} depth={depth + 1}/>)}</div>;
}
