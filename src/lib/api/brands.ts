import { and, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, brands, media, products } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireApi } from "@/lib/auth";
import { HttpError, int, slugify, str } from "@/lib/util";
import { body, idParam, type Route } from "./router";

function parseBrand(b: Record<string, unknown>) {
  const name = str(b.name, 100).replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new HttpError(400, "نام برند باید حداقل دو نویسه باشد");
  const slug = slugify(str(b.slug, 120) || name);
  const keywords = Array.isArray(b.seoKeywords) ? b.seoKeywords.map((x) => str(x, 80)).filter(Boolean).slice(0, 20) : str(b.seoKeywords, 1000).split(/[,،\n]/).map((x) => str(x, 80)).filter(Boolean).slice(0, 20);
  const relatedBlogPostIds = Array.isArray(b.relatedBlogPostIds) ? [...new Set(b.relatedBlogPostIds.map((x) => int(x, 1)))].slice(0, 20) : [];
  const logoMediaId = b.logoMediaId ? int(b.logoMediaId, 1) : null;
  const bannerMediaId = b.bannerMediaId ? int(b.bannerMediaId, 1) : null;
  let canonicalUrl: string | null = null;
  const rawCanonical = str(b.canonicalUrl, 500);
  if (rawCanonical) {
    try { const url = new URL(rawCanonical); if (!(["http:", "https:"].includes(url.protocol))) throw new Error(); canonicalUrl = url.toString(); }
    catch { throw new HttpError(400, "نشانی canonical باید URL معتبر http یا https باشد"); }
  }
  return {
    name, slug, logoMediaId, bannerMediaId, description: str(b.description, 15000) || null,
    seoTitle: str(b.seoTitle, 120) || null, metaDescription: str(b.metaDescription, 300) || null,
    seoKeywords: keywords, canonicalUrl, relatedBlogPostIds, isActive: b.isActive !== false,
    sortOrder: int(b.sortOrder ?? 0, 0, 10000), updatedAt: new Date(),
  };
}

async function validateAssets(data: ReturnType<typeof parseBrand>) {
  const ids = [data.logoMediaId, data.bannerMediaId].filter((id): id is number => id !== null);
  if (ids.length) {
    const files = await db.select({ id: media.id, mime: media.mime }).from(media).where(inArray(media.id, ids));
    if (files.length !== new Set(ids).size || files.some((file) => !file.mime.startsWith("image/"))) throw new HttpError(400, "لوگو یا بنر باید از فایل تصویری معتبر انتخاب شود");
  }
  if (data.relatedBlogPostIds.length) {
    const posts = await db.select({ id: blogPosts.id }).from(blogPosts).where(and(inArray(blogPosts.id, data.relatedBlogPostIds), eq(blogPosts.status, "published")));
    if (posts.length !== data.relatedBlogPostIds.length) throw new HttpError(400, "مقالات مرتبط باید منتشر شده باشند");
  }
}

export const brandRoutes: Route[] = [
  { method: "GET", pattern: "admin/brands", handler: async (req) => {
    await requireApi("PRODUCTS_EDIT");
    const q = str(req.nextUrl.searchParams.get("q"), 100);
    return db.select({ brand: brands, productCount: sql<number>`(select count(*)::int from products p where lower(btrim(p.brand)) = lower(btrim(${brands.name})) and p.status <> 'deleted')` })
      .from(brands).where(and(isNull(brands.deletedAt), q ? ilike(brands.name, `%${q}%`) : undefined)).orderBy(brands.sortOrder, brands.name);
  } },
  { method: "POST", pattern: "admin/brands", handler: async (req, _p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), data = parseBrand(await body(req));
    await validateAssets(data);
    const [row] = await db.insert(brands).values(data).returning();
    await audit(db, { userId: user.id, ...meta }, "brand.create", "brand", row.id, null, row);
    return row;
  } },
  { method: "PUT", pattern: "admin/brands/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), data = parseBrand(await body(req));
    await validateAssets(data);
    const [old] = await db.select().from(brands).where(eq(brands.id, id));
    if (!old || old.deletedAt) throw new HttpError(404, "برند پیدا نشد");
    const [row] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "brand.update", "brand", id, old, row);
    return row;
  } },
  { method: "DELETE", pattern: "admin/brands/:id", handler: async (_req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id);
    const [old] = await db.select().from(brands).where(eq(brands.id, id));
    if (!old || old.deletedAt) throw new HttpError(404, "برند پیدا نشد");
    const [row] = await db.update(brands).set({ isActive: false, updatedAt: new Date() }).where(eq(brands.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "brand.archive", "brand", id, old, row);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/brands/:id/trash", handler: async (_req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id);
    const [old] = await db.select().from(brands).where(eq(brands.id, id));
    if (!old || old.deletedAt) throw new HttpError(404, "برند پیدا نشد");
    const now = new Date();
    const [row] = await db.update(brands).set({ isActive: false, deletedAt: now, deletedBy: user.id, deletedWasActive: old.isActive, updatedAt: now }).where(eq(brands.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "brand.trash", "brand", id, { name: old.name, isActive: old.isActive }, { deletedAt: now });
    return { ok: true, id: row.id };
  } },
];
