import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogCategories, blogPosts, blogTags, contentPages, footerLinks } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { HttpError, int, slugify, str } from "../util";
import { normalizeBlocks } from "../page-builder";
import { body, idParam, type Route } from "./router";

const postValues = (b: Record<string, unknown>) => {
  const title = str(b.title, 180);
  const content = str(b.content, 200000);
  if (!title || !content) throw new HttpError(400, "عنوان و محتوای نوشته الزامی است");
  const status = b.status === "published" ? "published" : "draft";
  const tags = Array.isArray(b.tags)
    ? b.tags.map((x) => str(x, 50)).filter(Boolean).slice(0, 20)
    : str(b.tags, 500).split(/[،,]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
  return {
    title,
    slug: slugify(str(b.slug, 100) || title),
    excerpt: str(b.excerpt, 500) || null,
    content,
    coverImageId: b.coverImageId ? int(b.coverImageId, 1) : null,
    category: str(b.category, 80) || "سلامت و سبک زندگی",
    tags,
    seoTitle: str(b.seoTitle, 160) || null,
    metaDescription: str(b.metaDescription, 320) || null,
    canonicalUrl: str(b.canonicalUrl, 500) || null,
    status,
  };
};

const syncTaxonomy = async (category: string, tags: string[]) => {
  await db.insert(blogCategories).values({ name: category, slug: slugify(category) }).onConflictDoNothing();
  if (tags.length) await db.insert(blogTags).values(tags.map((name) => ({ name, slug: slugify(name) }))).onConflictDoNothing();
};

function pageValues(b: Record<string, unknown>) {
  const title = str(b.title, 180);
  const slug = slugify(str(b.slug, 100) || title);
  if (!title || !slug) throw new HttpError(400, "عنوان و نشانی صفحه الزامی است");
  const blocks = normalizeBlocks(b.blocks ?? []);
  return {
    title, slug, template: ["nature", "editorial", "minimal", "contact"].includes(String(b.template)) ? String(b.template) : "nature",
    summary: str(b.summary, 500) || null, blocks,
    metaTitle: str(b.metaTitle, 180) || null, metaDescription: str(b.metaDescription, 320) || null,
    status: b.status === "published" ? "published" : "draft",
  };
}

function footerValues(b: Record<string, unknown>) {
  const groupTitle = str(b.groupTitle, 60), label = str(b.label, 100), href = str(b.href, 500);
  if (!groupTitle || !label || !href) throw new HttpError(400, "عنوان گروه، متن پیوند و نشانی الزامی است");
  if (!(href.startsWith("/") && !href.startsWith("//")) && !/^https:\/\//i.test(href)) throw new HttpError(400, "نشانی پیوند باید داخلی یا HTTPS باشد");
  return { groupTitle, label, href, sortOrder: int(b.sortOrder ?? 0, 0, 10000), enabled: b.enabled !== false, updatedAt: new Date() };
}

export const contentRoutes: Route[] = [
  { method: "GET", pattern: "admin/site-pages", handler: async () => { await requireApi("SETTINGS_MANAGE"); return db.select().from(contentPages).orderBy(desc(contentPages.updatedAt)); } },
  { method: "POST", pattern: "admin/site-pages", handler: async (req, _p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), values = pageValues(await body(req));
    const [row] = await db.insert(contentPages).values({ ...values, createdBy: user.id }).returning();
    await audit(db, { userId: user.id, ...meta }, "site_page.create", "content_page", row.id, null, { title: row.title, slug: row.slug });
    return row;
  } },
  { method: "POST", pattern: "admin/site-pages/:id", handler: async (req, p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(contentPages).where(eq(contentPages.id, id));
    if (!old) throw new HttpError(404, "صفحه یافت نشد");
    if (old.slug === "home") throw new HttpError(400, "صفحه اصلی را از صفحه‌ساز پیشرفته مدیریت کنید");
    if (b.delete === true) { await db.delete(contentPages).where(eq(contentPages.id, id)); await audit(db, { userId: user.id, ...meta }, "site_page.delete", "content_page", id, { title: old.title, slug: old.slug }, null); return { ok: true }; }
    const values = pageValues(b);
    await db.update(contentPages).set({ ...values, updatedAt: new Date() }).where(eq(contentPages.id, id));
    await audit(db, { userId: user.id, ...meta }, "site_page.update", "content_page", id, { title: old.title, slug: old.slug, status: old.status }, { title: values.title, slug: values.slug, status: values.status });
    return { ok: true, id, ...values };
  } },
  { method: "GET", pattern: "admin/footer-links", handler: async () => { await requireApi("SETTINGS_MANAGE"); return db.select().from(footerLinks).orderBy(asc(footerLinks.groupTitle), asc(footerLinks.sortOrder), asc(footerLinks.id)); } },
  { method: "POST", pattern: "admin/footer-links", handler: async (req, _p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), values = footerValues(await body(req));
    const [row] = await db.insert(footerLinks).values(values).returning();
    await audit(db, { userId: user.id, ...meta }, "footer_link.create", "footer_link", row.id, null, row);
    return row;
  } },
  { method: "POST", pattern: "admin/footer-links/:id", handler: async (req, p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(footerLinks).where(eq(footerLinks.id, id));
    if (!old) throw new HttpError(404, "پیوند فوتر یافت نشد");
    if (b.delete === true) { await db.delete(footerLinks).where(eq(footerLinks.id, id)); await audit(db, { userId: user.id, ...meta }, "footer_link.delete", "footer_link", id, old, null); return { ok: true }; }
    const values = footerValues(b);
    await db.update(footerLinks).set(values).where(eq(footerLinks.id, id));
    await audit(db, { userId: user.id, ...meta }, "footer_link.update", "footer_link", id, old, values);
    return { ok: true, id };
  } },
  { method: "POST", pattern: "admin/blog", handler: async (req, _p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT");
    const values = postValues(await body(req));
    await syncTaxonomy(values.category, values.tags);
    const [post] = await db.insert(blogPosts).values({ ...values, authorId: user.id, publishedAt: values.status === "published" ? new Date() : null }).returning();
    await audit(db, { userId: user.id, ...meta }, "blog.create", "blog_post", post.id, null, { title: post.title, status: post.status });
    return post;
  } },
  { method: "POST", pattern: "admin/blog/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    if (!old) throw new HttpError(404, "نوشته یافت نشد");
    if (b.delete === true) {
      await db.delete(blogPosts).where(eq(blogPosts.id, id));
      await audit(db, { userId: user.id, ...meta }, "blog.delete", "blog_post", id, { title: old.title }, null);
      return { ok: true };
    }
    const values = postValues(b);
    await syncTaxonomy(values.category, values.tags);
    const patch = { ...values, publishedAt: values.status === "published" ? old.publishedAt ?? new Date() : null, updatedAt: new Date() };
    await db.update(blogPosts).set(patch).where(eq(blogPosts.id, id));
    await audit(db, { userId: user.id, ...meta }, "blog.update", "blog_post", id, { title: old.title, status: old.status }, { title: values.title, status: values.status });
    return { ok: true, id };
  } },
  { method: "GET", pattern: "admin/blog/taxonomy", handler: async () => {
    await requireApi("PRODUCTS_EDIT");
    const [categories, tags] = await Promise.all([
      db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
      db.select().from(blogTags).orderBy(asc(blogTags.name)),
    ]);
    return { categories, tags };
  } },
  { method: "POST", pattern: "admin/blog/categories", handler: async (req, _p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT");
    const b = await body(req), name = str(b.name, 80), slug = slugify(str(b.slug, 100) || name);
    if (!name) throw new HttpError(400, "نام دسته الزامی است");
    const [row] = await db.insert(blogCategories).values({ name, slug, description: str(b.description, 500) || null, sortOrder: int(b.sortOrder ?? 0, 0, 10000), isActive: b.isActive !== false }).returning();
    await audit(db, { userId: user.id, ...meta }, "blog.category.create", "blog_category", row.id, null, row);
    return row;
  } },
  { method: "POST", pattern: "admin/blog/categories/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(blogCategories).where(eq(blogCategories.id, id));
    if (!old) throw new HttpError(404, "دسته یافت نشد");
    if (b.delete === true) {
      const [used] = await db.select({ count: sql<number>`count(*)::int` }).from(blogPosts).where(eq(blogPosts.category, old.name));
      if (used.count) throw new HttpError(409, "این دسته در مقاله‌ها استفاده شده و قابل حذف نیست");
      await db.delete(blogCategories).where(eq(blogCategories.id, id));
      return { ok: true };
    }
    const name = str(b.name, 80), slug = slugify(str(b.slug, 100) || name);
    if (!name) throw new HttpError(400, "نام دسته الزامی است");
    await db.transaction(async (tx) => {
      await tx.update(blogCategories).set({ name, slug, description: str(b.description, 500) || null, sortOrder: int(b.sortOrder ?? 0, 0, 10000), isActive: b.isActive !== false, updatedAt: new Date() }).where(eq(blogCategories.id, id));
      if (name !== old.name) await tx.update(blogPosts).set({ category: name, updatedAt: new Date() }).where(eq(blogPosts.category, old.name));
    });
    await audit(db, { userId: user.id, ...meta }, "blog.category.update", "blog_category", id, old, { name, slug });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/blog/tags", handler: async (req, _p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), b = await body(req), name = str(b.name, 50), slug = slugify(str(b.slug, 100) || name);
    if (!name) throw new HttpError(400, "نام برچسب الزامی است");
    const [row] = await db.insert(blogTags).values({ name, slug }).returning();
    await audit(db, { userId: user.id, ...meta }, "blog.tag.create", "blog_tag", row.id, null, row);
    return row;
  } },
  { method: "POST", pattern: "admin/blog/tags/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(blogTags).where(eq(blogTags.id, id));
    if (!old) throw new HttpError(404, "برچسب یافت نشد");
    const affected = await db.select().from(blogPosts).where(sql`${blogPosts.tags} ? ${old.name}`);
    if (b.delete === true) {
      if (affected.length) throw new HttpError(409, "این برچسب در مقاله‌ها استفاده شده و قابل حذف نیست");
      await db.delete(blogTags).where(eq(blogTags.id, id));
      return { ok: true };
    }
    const name = str(b.name, 50), slug = slugify(str(b.slug, 100) || name);
    if (!name) throw new HttpError(400, "نام برچسب الزامی است");
    await db.transaction(async (tx) => {
      await tx.update(blogTags).set({ name, slug, updatedAt: new Date() }).where(eq(blogTags.id, id));
      if (name !== old.name) for (const post of affected) await tx.update(blogPosts).set({ tags: post.tags.map((tag) => tag === old.name ? name : tag), updatedAt: new Date() }).where(eq(blogPosts.id, post.id));
    });
    await audit(db, { userId: user.id, ...meta }, "blog.tag.update", "blog_tag", id, old, { name, slug });
    return { ok: true };
  } },
];
