import type { ReactNode } from "react";
import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";

const tones: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200", green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200", red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-emerald-50 text-emerald-700 ring-emerald-200", violet: "bg-violet-50 text-violet-700 ring-violet-200",
};
const STATUS_TONE: Record<string, string> = {
  active: "green", approved: "green", paid: "green", delivered: "green", completed: "green", signed: "green", resolved: "green", sent: "green", simulated: "blue",
  pending: "yellow", pending_payment: "yellow", reviewing: "yellow", preparing: "yellow", processing: "yellow", in_review: "yellow", pending_staff: "yellow", pending_customer: "blue",
  shipped: "blue", ready: "blue", rfq_sent: "blue", quotation_sent: "violet", price_calculated: "violet", supplier_found: "violet", internal_match_found: "violet", open: "blue",
  rejected: "red", cancelled: "red", suspended: "red", deleted: "red", failed: "red", out_of_stock: "red", returned: "red", refunded: "red",
  inactive: "gray", draft: "gray", closed: "gray", unpaid: "yellow", pending_verification: "violet",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone] ?? tones.gray}`}>{children}</span>;
}
export function StatusBadge({ status, map }: { status: string; map?: Record<string, string> }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{map?.[status] ?? status}</Badge>;
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5"><h3 className="font-bold text-slate-800">{title}</h3>{action}</header>}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, icon: Icon, tone = "blue", hint }: { label: string; value: ReactNode; icon: LucideIcon; tone?: string; hint?: string }) {
  const bg: Record<string, string> = { blue: "bg-emerald-100 text-emerald-700", green: "bg-emerald-100 text-emerald-700", yellow: "bg-amber-100 text-amber-700", red: "bg-rose-100 text-rose-700", violet: "bg-violet-100 text-violet-700" };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${bg[tone]}`}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate text-lg font-extrabold text-slate-800">{value}</div>
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      <Inbox className="h-10 w-10 text-slate-300" />
      <div className="font-bold text-slate-600">{title}</div>
      {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr>{head.map((h) => <th key={h} className="px-4 py-3 text-right font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <div className="p-6"><Empty title="موردی یافت نشد" /></div>}
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

export function LinkBtn({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  return <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-ghost"}>{children}</Link>;
}

export function Img({ id, alt, className = "" }: { id: number | null | undefined; alt: string; className?: string }) {
  if (!id) return <div className={`grid place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-3xl ${className}`}>⚙️</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/media/${id}`} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-slate-500">{k}</span><span className="text-left font-medium text-slate-800">{v}</span></div>;
}
