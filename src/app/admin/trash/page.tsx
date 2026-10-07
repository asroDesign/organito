import { Trash2 } from "lucide-react";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { TrashManager } from "@/components/TrashManager";
import { requirePage } from "@/lib/auth";

export default async function AdminTrashPage() {
  await requirePage({ anyPerm: ["PRODUCTS_EDIT", "PRODUCTS_DISABLE", "SETTINGS_MANAGE"] });
  return <>
    <PageHeader title="زباله و بازیابی" subtitle="بازیابی امن محصولات، مقاله‌ها، برندها و صفحات حذف‌شده" />
    <FeatureIntro className="mb-5" icon={Trash2} title="محتوا قابل برگشت است" text="انتقال به زباله، حذف نرم انجام می‌دهد. با بازیابی، وضعیت قبلی برمی‌گردد؛ سفارش، موجودی و اسناد حسابداری به این عملیات وابسته نیستند." />
    <TrashManager />
  </>;
}
