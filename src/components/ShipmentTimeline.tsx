import { inArray } from "drizzle-orm";
import { ClipboardCheck, PackageOpen, Package, Truck, Home, ExternalLink, XCircle } from "lucide-react";
import { db } from "@/db";
import { carriers, type sellerShipments } from "@/db/schema";
import { jdate } from "@/lib/util";

type Sh = typeof sellerShipments.$inferSelect;
const STEPS = [["pending", "ثبت و تأیید", ClipboardCheck], ["preparing", "آماده‌سازی", PackageOpen], ["ready", "بسته‌بندی", Package], ["shipped", "تحویل به پست", Truck], ["delivered", "تحویل به شما", Home]] as const;

export async function carrierMap(shs: Sh[]) {
  const ids = shs.map((s) => s.carrierId).filter(Boolean) as number[];
  const list = ids.length ? await db.select().from(carriers).where(inArray(carriers.id, ids)) : [];
  return new Map(list.map((c) => [c.id, c]));
}

export function trackingLink(url: string | null | undefined, code: string | null) {
  if (!url || !code) return null;
  return url.replace("{code}", encodeURIComponent(code));
}

export function ShipmentTimeline({ sh, trackingUrl, title }: { sh: Sh; trackingUrl?: string | null; title?: string }) {
  const idx = STEPS.findIndex(([k]) => k === sh.status);
  const cancelled = sh.status === "cancelled" || sh.status === "returned";
  const dates: Record<string, Date | null> = { pending: sh.createdAt, preparing: sh.preparedAt, ready: sh.preparedAt, shipped: sh.shippedAt, delivered: sh.deliveredAt };
  const link = trackingLink(trackingUrl, sh.trackingNumber);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {title && <div className="mb-3 flex items-center justify-between text-sm"><b>{title}</b><span className="text-xs text-slate-500">مرسوله #{sh.id.toLocaleString("fa-IR")}</span></div>}
      {cancelled ? (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="h-5 w-5" />این مرسوله {sh.status === "cancelled" ? "لغو شده" : "مرجوع شده"} است.</div>
      ) : (
        <div className="relative flex justify-between">
          <div className="absolute right-5 left-5 top-5 h-1 rounded bg-slate-200" />
          <div className="absolute right-5 top-5 h-1 rounded bg-gradient-to-l from-emerald-400 to-emerald-500 transition-all" style={{ width: `calc(${(Math.max(0, idx) / (STEPS.length - 1)) * 100}% - ${idx === STEPS.length - 1 ? 40 : 0}px)` }} />
          {STEPS.map(([k, l, I], i) => {
            const done = i <= idx;
            return (
              <div key={k} className="relative z-10 flex w-16 flex-col items-center text-center sm:w-20">
                <span className={`grid h-10 w-10 place-items-center rounded-full border-4 border-white shadow ${done ? (i === idx ? "bg-emerald-600 text-white ring-4 ring-emerald-100" : "bg-emerald-500 text-white") : "bg-slate-200 text-slate-400"}`}><I className="h-4 w-4" /></span>
                <span className={`mt-1.5 text-[11px] ${done ? "font-bold text-slate-800" : "text-slate-400"}`}>{l}</span>
                {done && dates[k] && <span className="text-[10px] text-slate-400">{jdate(dates[k])}</span>}
              </div>
            );
          })}
        </div>
      )}
      {(sh.carrier || sh.trackingNumber || sh.notes) && (
        <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
          <div><span className="text-xs text-slate-500">شرکت حمل</span><div className="font-bold">{sh.carrier ?? "—"}</div></div>
          <div><span className="text-xs text-slate-500">کد رهگیری</span><div className="font-mono font-bold" dir="ltr">{sh.trackingNumber ?? "—"}</div></div>
          <div><span className="text-xs text-slate-500">تاریخ ارسال</span><div className="font-bold">{jdate(sh.shippedAt)}</div></div>
          {sh.notes && <div className="text-xs text-slate-600 sm:col-span-3">توضیحات ارسال: {sh.notes}</div>}
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white sm:col-span-3"><ExternalLink className="h-3.5 w-3.5" />پیگیری مرسوله در سایت {sh.carrier}</a>}
        </div>
      )}
    </div>
  );
}
