import type { MetadataRoute } from "next";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, categories, products } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { siteBase } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, productRows, categoryRows, postRows] = await Promise.all([
    getSettings(),
    db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(sql`${products.status} in ('active','out_of_stock')`),
    db.select({ id: categories.id }).from(categories),
    db.select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt }).from(blogPosts).where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))),
  ]);
  const base = siteBase(s.siteUrl);
  const item = (path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number, lastModified?: Date) => ({ url: new URL(path, base).toString(), changeFrequency, priority, ...(lastModified ? { lastModified } : {}) });
  return [
    item("/", "daily", 1), item("/shop", "daily", 0.95), item("/blog", "daily", 0.85), item("/categories", "weekly", 0.8), item("/about", "monthly", 0.5), item("/contact", "monthly", 0.4), item("/faq", "monthly", 0.4),
    ...categoryRows.map((c) => item(`/shop?cat=${c.id}`, "weekly", 0.8)),
    ...productRows.map((p) => item(`/products/${p.slug}`, "weekly", 0.85, p.updatedAt)),
    ...postRows.map((p) => item(`/blog/${p.slug}`, "weekly", 0.75, p.updatedAt)),
  ];
}
