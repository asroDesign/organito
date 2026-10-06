import { eq, and, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { products, productVariants, sellerOffers } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ProductBarcodePrint } from "@/components/ProductBarcodePrint";

export const metadata = { title: "چاپ بارکد تنوع‌ها" };
export default async function ProductBarcodePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p || p.status === "deleted") notFound();
  if (u.staff) { if (!u.permissions.includes("PRODUCTS_VIEW")) notFound(); }
  else if (!u.sellerId || (u.sellerId !== p.ownerSellerId && !(await db.select({ id: sellerOffers.id }).from(sellerOffers).where(and(eq(sellerOffers.productId, id), eq(sellerOffers.sellerId, u.sellerId))).limit(1)).length)) notFound();
  const [variants, s] = await Promise.all([
    db.select().from(productVariants).where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true), isNull(productVariants.deletedAt))).orderBy(productVariants.id),
    getSettings(),
  ]);
  if (!variants.length) notFound();
  return <ProductBarcodePrint productName={p.nameFa} productSku={p.sku} variants={variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku }))} width={s.barcodeLabelWidth} height={s.barcodeLabelHeight} fontSize={s.barcodeFontSize} showName={!!s.barcodeShowProductName} showSku={!!s.barcodeShowSku} backHref={u.staff ? `/admin/products/${id}` : "/seller/products"} />;
}
