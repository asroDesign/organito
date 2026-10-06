import { notFound } from "next/navigation";
import { categoryOptions } from "@/lib/queries";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ne } from "drizzle-orm";
import { loadProductInitial } from "@/lib/productInitial";
import { getSettings } from "@/lib/settings";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await loadProductInitial(id) : null;
  if (!p) notFound();
  const [cats, choices, s] = await Promise.all([categoryOptions(), db.select({ id: products.id, name: products.nameFa }).from(products).where(ne(products.status, "deleted")).orderBy(products.nameFa), getSettings()]);
  return <><PageHeader title={`ویرایش: ${p.nameFa}`} /><ProductForm initial={p} categories={cats} productChoices={choices.filter((x) => x.id !== id)} productTypes={s.productTypes} certificationLabel={s.organicBadgeLabel} mode="admin" backTo="/admin/products/:id" /></>;
}
