"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { J_MONTHS, g2j, isoToJalali, j2g, jMonthLength, jalaliToIso, todayIso } from "@/lib/jalali";

const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const WEEK = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** Persian calendar picker. Submits a gregorian ISO date (YYYY-MM-DD) through a hidden input. */
export function JalaliDatePicker({ name, defaultValue, value: controlled, onChange, placeholder = "انتخاب تاریخ", allowEmpty }: {
  name?: string; defaultValue?: string; value?: string; onChange?: (iso: string) => void; placeholder?: string; allowEmpty?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue ?? (allowEmpty ? "" : todayIso()));
  const value = controlled ?? inner;
  const init = value || todayIso();
  const [y0, m0, d0] = init.split("-").map(Number);
  const [jv] = [g2j(y0, m0, d0)];
  const [view, setView] = useState<[number, number]>([jv[0], jv[1]]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const set = (iso: string) => { setInner(iso); onChange?.(iso); setOpen(false); };
  const [vy, vm] = view;
  const [gy, gm, gd] = j2g(vy, vm, 1);
  const offset = (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7;
  const len = jMonthLength(vy, vm);
  const sel = value ? g2j(...(value.split("-").map(Number) as [number, number, number])) : null;
  const move = (d: number) => { let m = vm + d, y = vy; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } setView([y, m]); };
  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button type="button" onClick={() => setOpen(!open)} className="input flex items-center justify-between text-right">
        <span className={value ? "" : "text-slate-400"}>{value ? fa(isoToJalali(value)) : placeholder}</span><CalendarDays className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} className="rounded-lg p-1 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            <div className="flex items-center gap-1 text-sm font-bold">
              <select value={vm} onChange={(e) => setView([vy, Number(e.target.value)])} className="rounded border-0 bg-transparent">{J_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <select value={vy} onChange={(e) => setView([Number(e.target.value), vm])} className="rounded border-0 bg-transparent">{Array.from({ length: 131 }, (_, i) => Math.max(vy,g2j(...todayIso().split("-").map(Number) as [number,number,number])[0])+5-i).map((y) => <option key={y} value={y}>{fa(y)}</option>)}</select>
            </div>
            <button type="button" onClick={() => move(1)} className="rounded-lg p-1 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEK.map((w) => <div key={w} className="py-1 text-slate-400">{w}</div>)}
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: len }, (_, i) => i + 1).map((d) => {
              const active = sel && sel[0] === vy && sel[1] === vm && sel[2] === d;
              return <button type="button" key={d} onClick={() => set(jalaliToIso(vy, vm, d))} className={`rounded-lg py-1.5 ${active ? "bg-emerald-600 text-white" : "hover:bg-emerald-50"}`}>{fa(d)}</button>;
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <button type="button" className="text-emerald-700" onClick={() => set(todayIso())}>امروز</button>
            {allowEmpty && <button type="button" className="text-slate-500" onClick={() => set("")}>پاک کردن</button>}
          </div>
        </div>
      )}
    </div>
  );
}
