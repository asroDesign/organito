import { requirePage } from "@/lib/auth";
import { IssueRegister } from "@/components/IssueRegister";

export default async function AdminIssues({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePage({ anyPerm: ["INVENTORY_MANAGE", "SHIPMENTS_MANAGE"] });
  const { status } = await searchParams;
  return <IssueRegister sellerId={null} status={status} base="/admin/warehouse-issues" />;
}
