"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { PRODUCT_COMPARE_STORAGE_KEY } from "./ProductCompareButton";

function readIds(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PRODUCT_COMPARE_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 4) : [];
  } catch { return []; }
}

export function ProductCompareDock() {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    const update = () => setIds(readIds());
    update();
    window.addEventListener("storage", update);
    window.addEventListener("organo-product-compare-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("organo-product-compare-change", update);
    };
  }, []);
  if (!ids.length) return null;
  const href = `/compare?ids=${ids.join(",")}`;
  const clear = () => {
    localStorage.removeItem(PRODUCT_COMPARE_STORAGE_KEY);
    setIds([]);
    window.dispatchEvent(new Event("organo-product-compare-change"));
  };
  return <aside dir="rtl" className="fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 p-2.5 shadow-xl backdrop-blur sm:bottom-5 sm:right-6">
    <Link href={href} className="flex min-w-0 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800">
      <ArrowLeftRight className="size-4 shrink-0"/><span className="truncate">مقایسهٔ محصولات</span><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/20 text-xs">{ids.length.toLocaleString("fa-IR")}</span>
    </Link>
    <button type="button" onClick={clear} aria-label="پاک کردن فهرست مقایسه" title="پاک کردن فهرست" className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X className="size-4"/></button>
  </aside>;
}
