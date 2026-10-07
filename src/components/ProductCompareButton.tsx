"use client";
import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "./client";

export const PRODUCT_COMPARE_STORAGE_KEY = "organo-product-compare-v1";

export function ProductCompareButton({ productId }: { productId: number }) {
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    const read = () => {
      try { const ids = JSON.parse(localStorage.getItem(PRODUCT_COMPARE_STORAGE_KEY) || "[]") as unknown; setSelected(Array.isArray(ids) && ids.includes(productId)); }
      catch { setSelected(false); }
    };
    read(); window.addEventListener("storage", read); return () => window.removeEventListener("storage", read);
  }, [productId]);

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation();
    try {
      const raw = JSON.parse(localStorage.getItem(PRODUCT_COMPARE_STORAGE_KEY) || "[]") as unknown;
      const ids = Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
      if (!selected && !ids.includes(productId) && ids.length >= 4) { toast("حداکثر ۴ محصول را می‌توانید هم‌زمان مقایسه کنید", false); return; }
      const next = selected ? ids.filter((id) => id !== productId) : ids.includes(productId) ? ids : [...ids, productId];
      localStorage.setItem(PRODUCT_COMPARE_STORAGE_KEY, JSON.stringify(next)); setSelected(next.includes(productId));
      window.dispatchEvent(new Event("organo-product-compare-change"));
      toast(next.includes(productId) ? "محصول برای مقایسه ذخیره شد؛ از نوار مقایسه بازش کنید" : "محصول از فهرست مقایسه حذف شد");
    } catch { toast("ذخیره فهرست مقایسه در این مرورگر ممکن نیست", false); }
  };

  return <button type="button" onClick={toggle} aria-label={selected ? "حذف محصول از مقایسه" : "افزودن محصول به مقایسه"} title={selected ? "در فهرست مقایسه" : "افزودن به مقایسه"} aria-pressed={selected} className={`grid size-10 place-items-center rounded-full border bg-white/95 shadow-md backdrop-blur transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${selected ? "border-amber-300 text-amber-700" : "border-slate-200 text-slate-600"}`}>
    <ArrowLeftRight className="size-5"/><span className="sr-only">مقایسه محصول</span>
  </button>;
}
