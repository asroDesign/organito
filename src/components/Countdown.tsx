"use client";
import { useEffect, useState } from "react";

const fa = (n: number) => String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export function Countdown({ to, compact, light }: { to: string; compact?: boolean; light?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <span className="inline-block h-6 w-28" />;
  const diff = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(diff / 864e5), h = Math.floor((diff / 36e5) % 24), m = Math.floor((diff / 6e4) % 60), s = Math.floor((diff / 1e3) % 60);
  if (compact) return <span dir="ltr" className="font-mono text-xs tabular-nums">{d > 0 ? `${fa(d)}d ` : ""}{fa(h)}:{fa(m)}:{fa(s)}</span>;
  const box = light ? "bg-white/15 text-white" : "bg-slate-900 text-white";
  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {[[d, "روز"], [h, "ساعت"], [m, "دقیقه"], [s, "ثانیه"]].map(([v, l], i) => (
        <div key={i} className={`flex min-w-11 flex-col items-center rounded-lg px-1.5 py-1 ${box}`}><b className="text-base tabular-nums leading-none">{fa(v as number)}</b><span className="mt-0.5 text-[9px] opacity-80">{l}</span></div>
      ))}
    </div>
  );
}
