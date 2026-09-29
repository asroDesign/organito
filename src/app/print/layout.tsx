import type { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">{children}</div>;
}
