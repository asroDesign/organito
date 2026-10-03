"use client";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { api } from "./client";

const faNum = (value: number) => value.toLocaleString("fa-IR");

export function ProductViewTracker({ productId, showCount }: { productId: number; showCount: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let sessionId = sessionStorage.getItem("product-view-session");
    if (!sessionId) {
      sessionId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem("product-view-session", sessionId);
    }
    const viewedKey = `product-viewed:${productId}:${sessionId}`;
    const lastViewedAt = Number(sessionStorage.getItem(viewedKey) || 0);
    let trackView = Date.now() - lastViewedAt > 5_000;
    if (trackView) sessionStorage.setItem(viewedKey, String(Date.now()));
    const endpoint = `/api/products/${productId}`;
    const ping = () => {
      // Keep visit tracking detached from rendering/navigation and let the browser
      // finish this small request even if the visitor leaves the page.
      void fetch(`${endpoint}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf": "1" },
        body: JSON.stringify({ sessionId, trackView }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const refresh = () => api<{ enabled: boolean; count: number }>(`${endpoint}/viewers`, "GET")
      .then((result) => { if (result.enabled) setCount(result.count); })
      .catch(() => undefined);
    void ping();
    if (!showCount) return;
    void refresh();
    const pingTimer = window.setInterval(() => { trackView = false; void ping(); }, 20_000);
    const countTimer = window.setInterval(() => { void refresh(); }, 15_000);
    return () => { window.clearInterval(pingTimer); window.clearInterval(countTimer); };
  }, [productId, showCount]);

  if (!showCount || count < 1) return null;
  return <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200"><Eye className="size-3.5" /><span>{faNum(count)} {count === 1 ? "نفر در حال مشاهده این محصول است" : "نفر در حال مشاهده این محصول هستند"}</span></div>;
}
