import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { AdminUpdateCenter } from "@/components/AdminUpdateCenter";
import { requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminUpdatesPage() {
  const user = await requirePage({ perm: "SETTINGS_MANAGE" });
  if (user.role !== "super_admin") redirect("/admin?denied=1");
  return <>
    <PageHeader title="به‌روزرسانی امن سامانه" subtitle="بستهٔ نسخه را بارگذاری کنید؛ سامانه امضا و سلامت فایل‌ها را بررسی می‌کند و مراحل پشتیبان‌گیری، migration و راه‌اندازی مجدد را انجام می‌دهد." />
    <Card><AdminUpdateCenter superAdmin={user.role === "super_admin"}/></Card>
  </>;
}
