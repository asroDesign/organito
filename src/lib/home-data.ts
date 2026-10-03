import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, sellers, type SitePageBlock } from "@/db/schema";
import { categoriesWithCounts, listShopProducts, vehicleMakes } from "./queries";
import { activeFestivals } from "./marketing";
import { getSettings } from "./settings";

export async function getHomeData(blocks: SitePageBlock[] = []) {
  const ids = [...new Set(blocks.flatMap(b => b.options?.productIds ?? []))];
  const categoryIds = [...new Set(blocks.map(b => b.options?.categoryId).filter((id): id is number => !!id))];
  const [all, selected, categoryProducts, cats, makes, festivals, farms, settings, latestPosts] = await Promise.all([
    listShopProducts({}), ids.length ? listShopProducts({ ids }, ids.length) : Promise.resolve([]), Promise.all(categoryIds.map(id => listShopProducts({ cat: String(id) }, 24))), categoriesWithCounts(), vehicleMakes(), activeFestivals(),
    db.select({ id: sellers.id, shopName: sellers.shopName, city: sellers.city, rating: sellers.rating }).from(sellers).where(eq(sellers.status, "approved")).limit(6), getSettings(),
    db.select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt, coverImageId: blogPosts.coverImageId, category: blogPosts.category, publishedAt: blogPosts.publishedAt }).from(blogPosts).where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))).orderBy(desc(blogPosts.publishedAt)).limit(12),
  ]);
  // Only public storefront settings are passed to the preview client.
  const { siteName, multiVendor, allowSellerSignup, heroMediaId, heroType, heroTitle, heroSubtitle, returnDays, currency } = settings;
  return { all: [...new Map([...all, ...selected, ...categoryProducts.flat()].map(p => [p.id, p])).values()], cats, makes, fests: festivals.map(f => ({ title: f.title, description: f.description, color: f.color, discountPercent: f.discountPercent, endsAt: f.endsAt.toISOString() })), farms, latestPosts: latestPosts.map(p => ({ ...p, content: "", publishedAt: p.publishedAt?.toISOString() ?? null })), st: { siteName, multiVendor, allowSellerSignup, heroMediaId, heroType, heroTitle, heroSubtitle, returnDays, currency } };
}
export type HomeData = Awaited<ReturnType<typeof getHomeData>>;
