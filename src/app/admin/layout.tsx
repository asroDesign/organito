import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { requirePage } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const u = await requirePage({ role: "staff" });
  return <Shell user={u} area="admin">{children}</Shell>;
}
