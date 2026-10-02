"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, toast } from "./client";

type PriceField = "cost" | "price" | "sale";
const asciiDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10));
const onlyDigits = (value: string) => asciiDigits(value).replace(/\D/g, "");
const grouped = (value: string) => {
  const digits = onlyDigits(value);
  return digits ? Number(digits).toLocaleString("fa-IR", { useGrouping: true, maximumFractionDigits: 0 }) : "";
};
const caretAfterDigits = (value: string, count: number) => {
  if (!count) return 0;
  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    if (/[۰-۹0-9٠-٩]/.test(value[i])) seen++;
    if (seen === count) return i + 1;
  }
  return value.length;
};

export function PriceEditor({ productId, variantId, cost, price, sale }: { productId: number; variantId: number | null; cost: number; price: number; sale: number }) {
  const [values, setValues] = useState({ cost: String(cost || ""), price: String(price || ""), sale: String(sale || "") });
  const [saved, setSaved] = useState(values);
  const [status, setStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const inFlight = useRef(false);
  const queued = useRef<typeof values | null>(null);
  const inputs = useRef<Record<PriceField, HTMLInputElement | null>>({ cost: null, price: null, sale: null });

  const changeValue = (field: PriceField, input: HTMLInputElement) => {
    const position = input.selectionStart ?? input.value.length;
    const digitsBefore = onlyDigits(input.value.slice(0, position)).length;
    const next = onlyDigits(input.value);
    setValues((old) => ({ ...old, [field]: next }));
    const formatted = grouped(next);
    requestAnimationFrame(() => {
      const element = inputs.current[field];
      if (!element) return;
      const caret = caretAfterDigits(formatted, digitsBefore);
      element.setSelectionRange(caret, caret);
    });
  };

  const save = useCallback(async (next: typeof values) => {
    if (inFlight.current) { queued.current = next; return; }
    inFlight.current = true;
    setStatus("saving");
    try {
      await api("/api/admin/product-prices", "POST", { productId, variantId, cost: Number(next.cost || 0), price: Number(next.price || 0), sale: Number(next.sale || 0) });
      setSaved(next);
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      toast((error as Error).message, false);
    } finally {
      inFlight.current = false;
      const latest = queued.current;
      queued.current = null;
      if (latest) void save(latest);
    }
  }, [productId, variantId]);

  useEffect(() => {
    if (values.cost === saved.cost && values.price === saved.price && values.sale === saved.sale) return;
    setStatus("pending");
    const timer = window.setTimeout(() => void save(values), 700);
    return () => window.clearTimeout(timer);
  }, [values, saved, save]);

  return <div className="min-w-[470px]">
    <div className="grid grid-cols-3 items-end gap-2">
      {(["cost", "price", "sale"] as const).map((key) => <label className="flex flex-col gap-1 text-[10px] text-slate-500" key={key}><span>{key === "cost" ? "هزینه خرید" : key === "price" ? "قیمت فروش" : "قبل از تخفیف"}</span><input ref={(element) => { inputs.current[key] = element; }} className="input !h-9 !px-2 text-xs" type="text" inputMode="numeric" dir="ltr" minLength={0} value={grouped(values[key])} onChange={(e) => changeValue(key, e.currentTarget)} /></label>)}
    </div>
    <p aria-live="polite" className={`mt-1 text-[10px] ${status === "error" ? "text-rose-600" : status === "saved" ? "text-emerald-700" : "text-amber-700"}`}>
      {status === "saving" ? "در حال ذخیره…" : status === "pending" ? "پس از توقف تایپ خودکار ذخیره می‌شود…" : status === "error" ? "ذخیره انجام نشد؛ دوباره مقدار را تغییر دهید." : "ذخیره شد"}
    </p>
  </div>;
}
