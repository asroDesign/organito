import type { MetadataRoute } from "next";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, blogTags, brands, categories, contentPages, products } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { requestOrigin, siteBase } from "@/lib/seo";
import { headers } from "next/headers";
import { slugify } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, productRows, categoryRows, postRows, pageRows, brandRows] = await Promise.all([
    getSettings(),
    db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(sql`${products.status} in ('active','out_of_stock')`),
    db.select({ id: categories.id }).from(categories),
    db.select({ slug: blogPosts.slug, tags: blogPosts.tags, updatedAt: blogPosts.updatedAt }).from(blogPosts).where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))),
    db.select({ slug: contentPages.slug, updatedAt: contentPages.updatedAt }).from(contentPages).where(eq(contentPages.status, "published")),
    db.select({ slug: brands.slug, updatedAt: brands.updatedAt }).from(brands).where(eq(brands.isActive, true)),
  ]);
  const usedTagNames = Array.from(new Set(postRows.flatMap((post) => post.tags)));
  const savedTagRows = usedTagNames.length ? await db.select({ name: blogTags.name, slug: blogTags.slug, canonicalUrl: blogTags.canonicalUrl, updatedAt: blogTags.updatedAt }).from(blogTags).where(inArray(blogTags.name, usedTagNames)) : [];
  const savedTagNames = new Set(savedTagRows.map((tag) => tag.name));
  const fallbackTagRows = usedTagNames.filter((name) => !savedTagNames.has(name)).map((name) => ({
    name, slug: slugify(name), canonicalUrl: null,
    updatedAt: postRows.filter((post) => post.tags.includes(name)).reduce<Date | null>((latest, post) => !latest || post.updatedAt > latest ? post.updatedAt : latest, null) ?? new Date(),
  }));
  const tagRows = [...savedTagRows, ...fallbackTagRows];
  const base = siteBase(s.siteUrl, requestOrigin(await headers()), true);
  const item = (path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number, lastModified?: Date) => ({ url: new URL(path, base).toString(), changeFrequency, priority, ...(lastModified ? { lastModified } : {}) });
  return [
    item("/", "daily", 1), item("/shop", "daily", 0.95), item("/blog", "daily", 0.85), item("/brands", "weekly", 0.75), item("/categories", "weekly", 0.8), item("/about", "monthly", 0.5), item("/contact", "monthly", 0.4), item("/faq", "monthly", 0.4),
    ...categoryRows.map((c) => item(`/shop?cat=${c.id}`, "weekly", 0.8)),
    ...productRows.map((p) => item(`/products/${p.slug}`, "weekly", 0.85, p.updatedAt)),
    ...postRows.map((p) => item(`/blog/${p.slug}`, "weekly", 0.75, p.updatedAt)),
    ...tagRows.filter((tag) => !tag.canonicalUrl).map((tag) => item(`/blog/tag/${tag.slug}`, "weekly", 0.6, tag.updatedAt)),
    ...brandRows.map((b) => item(`/brands/${b.slug}`, "weekly", 0.7, b.updatedAt)),
    ...pageRows.filter((p) => p.slug !== "about" && p.slug !== "contact").map((p) => item(`/pages/${p.slug}`, "monthly", 0.55, p.updatedAt)),
  ];
}
