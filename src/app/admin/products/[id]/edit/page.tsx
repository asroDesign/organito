import { notFound } from "next/navigation";
import { categoryOptions } from "@/lib/queries";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { loadProductInitial } from "@/lib/productInitial";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await loadProductInitial(id) : null;
  if (!p) notFound();
  const cats = await categoryOptions();
  return <><PageHeader title={`ویرایش: ${p.nameFa}`} /><ProductForm initial={p} categories={cats} mode="admin" backTo="/admin/products/:id" /></>;
}
