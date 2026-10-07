import type { Metadata } from "next";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, productVariants } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { listShopProducts } from "@/lib/queries";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCompareTable, type CompareProduct } from "@/components/ProductCompareTable";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return { title: `مقایسهٔ محصولات | ${settings.siteName}`, robots: { index: false, follow: true } };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const rawIds = (await searchParams).ids?.split(",") ?? [];
  const ids = [...new Set(rawIds.map((value) => Number(value)).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 4);
  const categoryRows = await db.select({ id: categories.id, name: categories.name }).from(categories);
  let catalog: Awaited<ReturnType<typeof listShopProducts>> = [];
  let productRows: { p: typeof products.$inferSelect }[] = [];
  let variantRows: (typeof productVariants.$inferSelect)[] = [];
  if (ids.length) {
    [catalog, productRows, variantRows] = await Promise.all([
      listShopProducts({ ids }, 4),
      db.select({ p: products }).from(products).where(and(inArray(products.id, ids), inArray(products.status, ["active", "out_of_stock"]))),
      db.select().from(productVariants).where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true), isNull(productVariants.deletedAt))),
    ]);
  }
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
  const variantsByProduct = new Map<number, typeof variantRows>();
  for (const variant of variantRows) variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant]);
  const productById = new Map(productRows.map(({ p }) => [p.id, p]));
  const compareProducts: CompareProduct[] = ids.flatMap((id) => {
    const product = productById.get(id), summary = catalogById.get(id);
    if (!product || !summary) return [];
    return [{
      id, slug: product.slug, nameFa: product.nameFa, brand: product.brand, sku: product.sku,
      category: categoryNames.get(product.categoryId ?? -1) ?? "", authenticity: product.authenticity,
      productType: product.productType ?? "", country: product.country ?? "", imageId: product.mainImageId,
      minPrice: summary.minPrice, maxPrice: summary.maxPrice, available: summary.available, inStock: summary.inStock, inquiryOnly: product.inquiryOnly || (variantsByProduct.get(id) ?? []).some((variant) => variant.inquiryOnly),
      specs: (product.specs ?? []).filter((spec) => !spec.hidden), options: product.options ?? [],
      variants: (variantsByProduct.get(id) ?? []).map((variant) => ({
        id: variant.id, title: variant.title, attrs: variant.attrs ?? {}, price: product.inquiryOnly || variant.inquiryOnly ? 0 : Number(variant.price ?? 0),
        available: Math.max(0, variant.onHand - variant.reserved), unit: variant.inventoryUnit, sellable: variant.isSellable, inquiryOnly: product.inquiryOnly || variant.inquiryOnly,
      })),
    }];
  });
  return <><SiteHeader/><main className="mx-auto min-h-[55vh] max-w-7xl px-4 py-8"><ProductCompareTable products={compareProducts}/></main><SiteFooter/></>;
}
