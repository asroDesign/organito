"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);
  function toggle() {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("organo-color-mode", next ? "dark" : "light"); } catch { /* Theme remains active for this page. */ }
    setDark(next);
  }
  return <button type="button" onClick={toggle} aria-label={dark === null ? "تغییر پوسته" : dark ? "فعال‌کردن پوستهٔ روشن" : "فعال‌کردن پوستهٔ تیره"} title={dark ? "پوستهٔ روشن" : "پوستهٔ تیره"} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50">
    {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
  </button>;
}
