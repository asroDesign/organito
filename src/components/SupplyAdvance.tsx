"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "./client";

const L: Record<string, string> = { purchasing: "۱۲. شروع خرید", received: "۱۳. دریافت کالا", ready_to_ship: "آماده ارسال", shipped: "ارسال", completed: "۱۴. تحویل و تسویه", cancelled: "لغو" };
export function SupplyAdvance({ id, options }: { id: number; options: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!options.length) return null;
  return (
    <>
      {options.map((o) => (
        <button key={o} disabled={busy} className={o === "cancelled" ? "btn-danger" : "btn-ghost"} onClick={async () => {
          const extra: Record<string, unknown> = {};
          if (o === "shipped") {
            const carrier = window.prompt("شرکت حمل:", "تیپاکس"); if (!carrier) return;
            const trackingNumber = window.prompt("کد رهگیری:"); if (!trackingNumber) return;
            Object.assign(extra, { carrier, trackingNumber });
          }
          if (o === "cancelled" && !window.confirm("لغو درخواست؟")) return;
          setBusy(true);
          try { await api(`/api/admin/supply/${id}`, "POST", { action: "advance", to: o, ...extra }); toast("وضعیت به‌روزرسانی شد"); router.refresh(); }
          catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
        }}>{L[o] ?? o}</button>
      ))}
    </>
  );
}
