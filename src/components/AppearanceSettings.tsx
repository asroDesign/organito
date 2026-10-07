"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, RotateCcw, Save, Sparkles } from "lucide-react";
import { api, toast } from "./client";

type Mode = "light" | "dark" | "system";
type Palette = "sunshine" | "forest" | "ocean";
const paletteLabels: Record<Palette, string> = { sunshine: "زرد آفتابی", forest: "سبز جنگلی", ocean: "آبی اقیانوسی" };

export function AppearanceSettings({ initialMode, initialPalette }: { initialMode: string; initialPalette: string }) {
  const router = useRouter();
  const mode = (value: string): Mode => value === "dark" || value === "system" ? value : "light";
  const palette = (value: string): Palette => value === "forest" || value === "ocean" ? value : "sunshine";
  const [savedMode, setSavedMode] = useState<Mode>(mode(initialMode));
  const [savedPalette, setSavedPalette] = useState<Palette>(palette(initialPalette));
  const [draftMode, setDraftMode] = useState<Mode>(mode(initialMode));
  const [draftPalette, setDraftPalette] = useState<Palette>(palette(initialPalette));
  const [busy, setBusy] = useState(false);
  const themeBeforePreview = useRef<string | null>(null);
  const hasChanges = savedMode !== draftMode || savedPalette !== draftPalette;

  function preview() {
    if (!themeBeforePreview.current) themeBeforePreview.current = document.documentElement.dataset.theme ?? "light";
    document.documentElement.dataset.palette = draftPalette;
    const resolved = draftMode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : draftMode;
    document.documentElement.dataset.theme = resolved;
    toast("پیش‌نمایش روی همین مرورگر اعمال شد؛ هنوز ذخیره نشده است.");
  }
  function revertPreview() {
    document.documentElement.dataset.palette = savedPalette;
    if (themeBeforePreview.current) document.documentElement.dataset.theme = themeBeforePreview.current;
    else document.documentElement.dataset.theme = savedMode === "dark" ? "dark" : savedMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    themeBeforePreview.current = null;
    setDraftMode(savedMode); setDraftPalette(savedPalette);
  }
  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/settings", "POST", { appearanceMode: draftMode, appearancePalette: draftPalette });
      setSavedMode(draftMode); setSavedPalette(draftPalette);
      document.documentElement.dataset.defaultTheme = draftMode;
      document.documentElement.dataset.palette = draftPalette;
      const resolved = draftMode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : draftMode;
      document.documentElement.dataset.theme = resolved;
      try { localStorage.removeItem("organo-color-mode"); } catch { /* Server preference still applies on the next visit. */ }
      themeBeforePreview.current = null;
      toast("پوستهٔ پیش‌فرض فروشگاه ذخیره شد"); router.refresh();
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  }
  function resetDraft() { setDraftMode("light"); setDraftPalette("sunshine"); }

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm font-bold">حالت پیش‌فرض
        <select className="input mt-2" value={draftMode} onChange={(event) => setDraftMode(mode(event.target.value))}>
          <option value="light">روشن</option><option value="dark">تیره</option><option value="system">مطابق تنظیم دستگاه</option>
        </select>
        <small className="mt-1 block font-normal leading-6 text-slate-500">بازدیدکننده می‌تواند از دکمهٔ خورشید/ماه در سربرگ حالت دلخواهش را روی همان دستگاه انتخاب کند.</small>
      </label>
      <label className="block text-sm font-bold">رنگ سازمانی
        <select className="input mt-2" value={draftPalette} onChange={(event) => setDraftPalette(palette(event.target.value))}>
          {Object.entries(paletteLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <small className="mt-1 block font-normal leading-6 text-slate-500">رنگ‌های دکمه‌ها، پیوندها و نشان‌ها تغییر می‌کنند؛ نام، لوگو و محتوای صفحه‌ساز دست‌نخورده می‌مانند.</small>
      </label>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(["sunshine", "forest", "ocean"] as Palette[]).map((key) => <button key={key} type="button" onClick={() => setDraftPalette(key)} className={`theme-preview-card rounded-2xl border p-4 text-right ${draftPalette === key ? "border-emerald-600 ring-2 ring-emerald-200" : "border-slate-200"}`}>
        <span data-palette={key} className="block rounded-xl bg-leaf-pattern p-3 text-slate-900">
          <span className="flex items-center justify-between"><b className="text-sm">{paletteLabels[key]}</b>{draftPalette === key && <Check className="size-4 text-emerald-700"/>}</span>
          <span className="mt-3 flex gap-2"><i className="h-7 flex-1 rounded-lg bg-emerald-600"/><i className="h-7 w-12 rounded-lg bg-amber-400"/><i className="h-7 w-12 rounded-lg bg-slate-200"/></span>
          <span className="mt-2 block text-xs text-slate-500">نمونهٔ دکمه، تأکید و سطح</span>
        </span>
      </button>)}
    </div>
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={preview} className="btn-primary"><Eye className="size-4"/>پیش‌نمایش</button>
      <button type="button" onClick={revertPreview} className="btn-sm"><RotateCcw className="size-4"/>لغو پیش‌نمایش</button>
      <button type="button" onClick={resetDraft} className="btn-sm"><Sparkles className="size-4"/>بازگشت به زرد آفتابی</button>
      <button type="button" disabled={busy || !hasChanges} onClick={save} className="btn-success disabled:cursor-not-allowed"><Save className="size-4"/>{busy ? "در حال ذخیره…" : "ذخیره برای فروشگاه و پنل"}</button>
    </div>
    <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">برای دیدن پیش‌نمایش به صفحه‌ای از فروشگاه یا پنل بروید. لغو پیش‌نمایش ظاهر ذخیره‌شده را برمی‌گرداند. تغییر حالت روشن/تیرهٔ کاربر جداگانه در مرورگر او نگهداری می‌شود.</p>
  </div>;
}
