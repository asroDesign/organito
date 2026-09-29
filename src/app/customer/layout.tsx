import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { requirePage } from "@/lib/auth";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const u = await requirePage();
  return <Shell user={u} area="customer">{children}</Shell>;
}
