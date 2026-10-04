import { categoryOptions } from "@/lib/queries";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { getSettings } from "@/lib/settings";

export default async function SellerNewProduct() {
  await requirePage({ role: "seller" });
  const [cats, s] = await Promise.all([categoryOptions(), getSettings()]);
  return <><PageHeader title="تعریف محصول جدید" subtitle="محصول پس از ثبت در وضعیت «در انتظار بررسی» قرار می‌گیرد" /><ProductForm categories={cats} productTypes={s.productTypes} mode="seller" backTo="/seller/products" /></>;
}
