"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Package, Store, ShoppingBag, Search, Warehouse, Calculator, LifeBuoy, MessageSquare, Users, Settings, ShieldCheck, Truck, Wallet, Menu, X, FolderTree, Tag, User, MapPin, BadgePercent, Flame, ClipboardList, FileText, FileImage, Heart, AlertTriangle, ChevronDown,
} from "lucide-react";

const ICONS = { LayoutDashboard, Package, Store, ShoppingBag, Search, Warehouse, Calculator, LifeBuoy, MessageSquare, Users, Settings, ShieldCheck, Truck, Wallet, FolderTree, Tag, User, MapPin, BadgePercent, Flame, ClipboardList, FileText, FileImage, Heart, AlertTriangle };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
export type NavGroup = { label: string; icon: keyof typeof ICONS; items: NavItem[] };

export function SideNav({ items, groups, mobile, title }: { items: NavItem[]; groups?: NavGroup[]; mobile?: boolean; title?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  const allItems = [...items, ...(groups ?? []).flatMap((group) => group.items)];
  const isActive = (h: string) => path === h || (h.split("/").length > 2 && path.startsWith(h + "/")) || (path.startsWith(h + "/") && !allItems.some((i) => i.href !== h && path.startsWith(i.href)));
  const list = (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const active = isActive(it.href);
        return (
          <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
            className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`}>
            <Icon className="h-[18px] w-[18px]" />{it.label}
          </Link>
        );
      })}
      {groups?.map((group) => {
        const GroupIcon = ICONS[group.icon];
        const active = group.items.some((item) => isActive(item.href));
        const expanded = openGroups[group.label] ?? active;
        return <section key={group.label} className="mb-1">
          <button type="button" aria-expanded={expanded} onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !expanded }))}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-right text-[13px] font-bold transition ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}>
            <GroupIcon className="size-4 shrink-0"/><span className="min-w-0 flex-1">{group.label}</span><ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}/>
          </button>
          {expanded && <div className="mr-[1.1rem] mt-1 space-y-0.5 border-r border-slate-200 pr-2">
            {group.items.map((it) => { const Icon = ICONS[it.icon]; const selected = isActive(it.href); return <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition ${selected ? "bg-emerald-100 font-bold text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Icon className="size-4 shrink-0"/><span>{it.label}</span></Link>; })}
          </div>}
        </section>;
      })}
    </nav>
  );
  if (!mobile) return list;
  return (
    <>
      <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="بازکردن منوی پنل" aria-expanded={open}><Menu className="h-5 w-5" /></button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] lg:hidden" dir="rtl">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={title ?? "منوی پنل"} className="absolute inset-y-0 right-0 flex w-[min(21rem,88vw)] flex-col bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4"><b>{title}</b><button type="button" className="rounded-lg p-2 hover:bg-slate-100" aria-label="بستن منو" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            {list}
          </div>
        </div>, document.body
      )}
    </>
  );
}
