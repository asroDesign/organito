"use client";
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { api, toast } from "./client";
import { currencyUnit } from "@/lib/util";

export function GatewayPayButton({ url, amount, label = "پرداخت آنلاین با زرین‌پال", className = "btn-primary" }: { url: string; amount: number; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} className={className} onClick={async () => {
      setBusy(true);
      try {
        const r = await api<{ url: string }>(url, "POST", {});
        window.location.href = r.url;
      } catch (e) { toast((e as Error).message, false); setBusy(false); }
    }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{busy ? "در حال انتقال به درگاه…" : `${label} (${amount.toLocaleString("fa-IR")} ${currencyUnit()})`}
    </button>
  );
}
