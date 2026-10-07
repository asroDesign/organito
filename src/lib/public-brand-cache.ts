import { and, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { PUBLIC_BRANDS_TAG } from "@/lib/public-cache";

const readPublicBrandIndex = unstable_cache(async () => db.select({
  brand: brands,
  productCount: sql<number>`(select count(*)::int from products p where lower(regexp_replace(btrim(p.brand), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(${brands.name}), '\\s+', ' ', 'g')) and p.status in ('active','out_of_stock'))`,
}).from(brands).where(eq(brands.isActive, true)).orderBy(brands.sortOrder, brands.name), ["public-brand-index-v1"], { tags: [PUBLIC_BRANDS_TAG], revalidate: 300 });

export async function getPublicBrandIndex() { return readPublicBrandIndex(); }

export async function getPublicBrand(slug: string) {
  return unstable_cache(async () => {
    const [brand] = await db.select().from(brands).where(and(eq(brands.slug, decodeURIComponent(slug)), eq(brands.isActive, true))).limit(1);
    return brand ?? null;
  }, ["public-brand-v1", slug], { tags: [PUBLIC_BRANDS_TAG], revalidate: 300 })();
}
