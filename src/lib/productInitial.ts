import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products, productVariants } from "@/db/schema";
import type { ProductInitial } from "@/components/ProductForm";

export async function loadProductInitial(id: number): Promise<(ProductInitial & { ownerSellerId: number | null; status: string }) | null> {
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p || p.status === "deleted") return null;
  const imgs = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.sortOrder);
  const vars = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  return {
    ...p, imageIds: imgs.map((i) => i.mediaId),
    variants: vars.map((v) => ({ id: v.id, title: v.title, attrs: v.attrs, sku: v.sku, price: v.price, onHand: v.onHand, isActive: v.isActive })),
  };
}
