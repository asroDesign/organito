import { requirePage } from "@/lib/auth";
import { IssueRegister } from "@/components/IssueRegister";

export default async function SellerIssues({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = await requirePage({ role: "seller" });
  const { status } = await searchParams;
  return <IssueRegister sellerId={u.sellerId!} status={status} base="/seller/warehouse-issues" />;
}
