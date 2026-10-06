import { categoryOptions } from "@/lib/queries";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ne } from "drizzle-orm";
import { getSettings } from "@/lib/settings";

export default async function NewProduct() {
  await requirePage({ perm: "PRODUCTS_CREATE" });
  const [cats, choices, s] = await Promise.all([categoryOptions(), db.select({ id: products.id, name: products.nameFa }).from(products).where(ne(products.status, "deleted")).orderBy(products.nameFa), getSettings()]);
  return <><PageHeader title="افزودن محصول کامل" subtitle="محصول انبار مرکزی" /><ProductForm categories={cats} productChoices={choices} productTypes={s.productTypes} certificationLabel={s.organicBadgeLabel} mode="admin" backTo="/admin/products/:id" /></>;
}
