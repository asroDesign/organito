import { requirePage } from "@/lib/auth";
import { SessionManager } from "@/components/SessionManager";

export const dynamic = "force-dynamic";

export default async function CustomerSecurityPage() {
  await requirePage();
  return <SessionManager/>;
}
