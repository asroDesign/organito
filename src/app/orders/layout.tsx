import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { requirePage } from "@/lib/auth";

export default async function OrdersLayout({ children }: { children: ReactNode }) {
  const u = await requirePage({ role: "staff", perm: "ORDERS_VIEW" });
  return <Shell user={u} area="admin">{children}</Shell>;
}
