"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Megaphone, Sparkles, Tag } from "lucide-react";
import { Modal } from "@/components/Modal";

type Popup = { id: string; enabled: boolean; title: string; body: string; imageId: number; productIds: number[]; buttonLabel: string; delaySeconds: number; repeatHours: number };
type Props = {
  announcement: { enabled: boolean; text: string; href: string; theme: string };
  popups: Popup[];
};

const tones: Record<string, string> = {
  sunshine: "border-amber-200 bg-amber-400 text-amber-950",
  forest: "border-emerald-800 bg-emerald-900 text-white",
  rose: "border-rose-200 bg-rose-600 text-white",
};

function safeHref(href: string) {
  return /^https:\/\//i.test(href) || (/^\/(?![\\/])[^\\\u0000-\u001f]*$/.test(href));
}

export function StorefrontMessages({ announcement, popups }: Props) {
  const pathname = usePathname() ?? "/";
  const [activePopup, setActivePopup] = useState<Popup | null>(null);
  const blockedPath = /^\/(admin|seller|customer|login|register|forgot-password|reset-password|api)(\/|$)/.test(pathname) || pathname === "/home-builder-preview";
  const popupCandidates = useMemo(() => popups.filter((popup) => popup.enabled && popup.productIds.length > 0), [popups]);

  useEffect(() => {
    if (blockedPath || !popupCandidates.length) return;

    let selected: Popup | undefined;
    try {
      selected = popupCandidates.find((popup) => {
        const key = `storefront-special:${popup.id}`;
        const lastShown = Number(localStorage.getItem(key) ?? 0);
        const cooldown = Math.max(1, popup.repeatHours) * 60 * 60 * 1000;
        return !lastShown || Date.now() - lastShown >= cooldown;
      });
    } catch {
      selected = popupCandidates[0];
    }
    if (!selected) return;

    const timer = window.setTimeout(() => {
      setActivePopup(selected!);
      try { localStorage.setItem(`storefront-special:${selected!.id}`, String(Date.now())); } catch { /* The offer still works when storage is unavailable. */ }
    }, Math.max(0, selected.delaySeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [blockedPath, popupCandidates]);

  if (blockedPath) return null;
  const tone = tones[announcement.theme] ?? tones.sunshine;
  const announcementHref = announcement.href && safeHref(announcement.href) ? announcement.href : "";
  const productLink = activePopup ? `/shop?products=${activePopup.productIds.join(",")}` : "/shop";
  return <>
    {announcement.enabled && announcement.text.trim() && <div role="region" aria-label="اعلان فروشگاه" className={`relative z-50 border-b ${tone}`}>
      <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-bold leading-6 sm:text-sm">
        <Megaphone className="size-4 shrink-0" aria-hidden="true" />
        <span>{announcement.text}</span>
        {announcementHref && <a href={announcementHref} className="inline-flex shrink-0 items-center gap-1 underline underline-offset-2" target={announcementHref.startsWith("https://") ? "_blank" : undefined} rel={announcementHref.startsWith("https://") ? "noopener noreferrer" : undefined} aria-label="مشاهده جزئیات اعلان">
          <span className="hidden sm:inline">مشاهده</span><ArrowLeft className="size-3.5" />
        </a>}
      </div>
    </div>}
    {activePopup && <Modal title={activePopup.title} onClose={() => setActivePopup(null)}>
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
        {activePopup.imageId > 0 ? <Link href={productLink} onClick={() => setActivePopup(null)} className="block max-h-64 overflow-hidden bg-amber-50">
          <img src={`/api/media/${activePopup.imageId}`} alt={activePopup.title} className="max-h-64 w-full object-cover" />
        </Link> : <div className="grid min-h-36 place-items-center bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 text-amber-700"><Sparkles className="size-12" aria-hidden="true" /></div>}
        <div className="p-5 text-center sm:p-7">
          <span className="mx-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"><Tag className="size-3.5"/>{activePopup.productIds.length.toLocaleString("fa-IR")} محصول منتخب</span>
          {activePopup.body && <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-600">{activePopup.body}</p>}
          <Link href={productLink} onClick={() => setActivePopup(null)} className="btn-primary mt-5 inline-flex min-h-11 justify-center px-6">{activePopup.buttonLabel || "مشاهده پیشنهادها"}<ArrowLeft className="size-4"/></Link>
        </div>
      </div>
    </Modal>}
  </>;
}
