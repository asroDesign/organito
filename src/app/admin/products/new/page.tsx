import { categoryOptions } from "@/lib/queries";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";

export default async function NewProduct() {
  await requirePage({ perm: "PRODUCTS_CREATE" });
  const cats = await categoryOptions();
  return <><PageHeader title="افزودن محصول کامل" subtitle="محصول انبار مرکزی" /><ProductForm categories={cats} mode="admin" backTo="/admin/products/:id" /></>;
}
