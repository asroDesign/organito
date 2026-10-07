import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { products, stories } from "@/db/schema";

export async function getActiveStories(now = new Date()) {
  return db.select({
    story: stories, productName: products.nameFa, productSlug: products.slug,
  }).from(stories).leftJoin(products, eq(products.id, stories.productId)).where(and(
    eq(stories.status, "published"),
    or(isNull(stories.startsAt), lte(stories.startsAt, now)),
    or(isNull(stories.endsAt), gt(stories.endsAt, now)),
  )).orderBy(stories.sortOrder, stories.id).limit(20);
}
