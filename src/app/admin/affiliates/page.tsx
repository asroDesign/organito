import { Link2 } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import AffiliateAdminClient from "@/components/AffiliateAdminClient";

export default async function AffiliatesAdminPage() {
  await requirePage({ perm: "MARKETING_MANAGE" });
  return <><PageHeader title="همکاری در فروش" subtitle="مدیریت پورسانت، همکاران، محصولات مشمول و درخواست‌های تسویه"/><AffiliateAdminClient/></>;
}
