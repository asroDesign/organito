"use client";

import { useState } from "react";
import { Check, Copy, Send, Share2 } from "lucide-react";

export function BlogShareActions({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const currentUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url: currentUrl }); return; } catch { /* user closed share sheet */ }
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { window.prompt("پیوند مقاله را کپی کنید", currentUrl); }
  };
  const copy = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { window.prompt("پیوند مقاله را کپی کنید", currentUrl); }
  };
  const encodedTitle = encodeURIComponent(title);
  return <div className="flex items-center gap-2" aria-label="اشتراک‌گذاری مقاله">
    <button type="button" onClick={() => void share()} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900" aria-label="اشتراک‌گذاری یا کپی پیوند">
      {copied ? <Check className="size-4 text-emerald-700" /> : <Share2 className="size-4" />}
    </button>
    <button type="button" onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodedTitle}`, "_blank", "noopener,noreferrer")} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" aria-label="ارسال در تلگرام"><Send className="size-4" /></button>
    <button type="button" onClick={() => void copy()} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900" aria-label={copied ? "پیوند کپی شد" : "کپی پیوند"}>
      {copied ? <Check className="size-4 text-emerald-700" /> : <Copy className="size-4" />}
    </button>
  </div>;
}
