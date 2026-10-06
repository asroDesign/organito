import { notFound } from "next/navigation";
import { categoryOptions } from "@/lib/queries";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/ProductForm";
import { loadProductInitial } from "@/lib/productInitial";
import { getSettings } from "@/lib/settings";

export default async function SellerEditProduct({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage({ role: "seller" });
  const id = Number((await params).id);
  const p = Number.isInteger(id) ? await loadProductInitial(id) : null;
  if (!p || p.ownerSellerId !== u.sellerId) notFound();
  const [cats, s] = await Promise.all([categoryOptions(), getSettings()]);
  return <><PageHeader title={`ویرایش: ${p.nameFa}`} /><ProductForm initial={p} categories={cats} productTypes={s.productTypes} certificationLabel={s.organicBadgeLabel} mode="seller" backTo="/seller/products" /></>;
}
