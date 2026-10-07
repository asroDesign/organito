import { asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogCategories, blogPosts, blogTags, contentPageRevisions, contentPages, footerLinks, media } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { HttpError, int, slugify, str } from "../util";
import { normalizeBlocks } from "../page-builder";
import { body, idParam, type Route } from "./router";

const postValues = (b: Record<string, unknown>, canPublish: boolean) => {
  const title = str(b.title, 180);
  const content = str(b.content, 200000);
  const contentType = ["text", "video", "audio"].includes(String(b.contentType)) ? String(b.contentType) : "text";
  if (!title || (contentType === "text" && !content)) throw new HttpError(400, "عنوان و محتوای متنی نوشته الزامی است");
  const requestedStatus = ["published", "in_review"].includes(String(b.status)) ? String(b.status) : "draft";
  if (requestedStatus === "published" && !canPublish) throw new HttpError(403, "انتشار مقاله نیازمند مجوز تأیید محتوا است؛ مقاله را برای بازبینی ارسال کنید");
  const status = requestedStatus;
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
    contentType,
    videoMediaId: b.videoMediaId ? int(b.videoMediaId, 1) : null,
    audioMediaId: b.audioMediaId ? int(b.audioMediaId, 1) : null,
  };
};

async function validateBlogMedia(values: ReturnType<typeof postValues>, requiresAsset: boolean) {
  const mediaId = values.contentType === "video" ? values.videoMediaId : values.contentType === "audio" ? values.audioMediaId : null;
  if (values.contentType === "text") return;
  if (!mediaId) {
    if (requiresAsset) throw new HttpError(400, values.contentType === "video" ? "برای مقاله ویدئویی فایل ویدئو الزامی است" : "برای مقاله صوتی فایل صوتی الزامی است");
    return;
  }
  const [asset] = await db.select({ id: media.id, mime: media.mime }).from(media).where(eq(media.id, mediaId));
  const matches = asset && (values.contentType === "video" ? asset.mime.startsWith("video/") : asset.mime.startsWith("audio/"));
  if (!matches) throw new HttpError(400, "فایل انتخاب‌شده با نوع محتوای مقاله سازگار نیست");
}

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

const pageDocument = (page: typeof contentPages.$inferSelect) => ({
  title: page.title, slug: page.slug, template: page.template, summary: page.summary,
  blocks: page.blocks, metaTitle: page.metaTitle, metaDescription: page.metaDescription, status: page.status,
});

async function preservePageRevision(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], page: typeof contentPages.$inferSelect, userId: number) {
  await tx.insert(contentPageRevisions).values({ pageId: page.id, document: pageDocument(page), createdBy: userId });
  const oldRevisions = await tx.select({ id: contentPageRevisions.id }).from(contentPageRevisions)
    .where(eq(contentPageRevisions.pageId, page.id)).orderBy(desc(contentPageRevisions.createdAt), desc(contentPageRevisions.id)).offset(20);
  if (oldRevisions.length) await tx.delete(contentPageRevisions).where(inArray(contentPageRevisions.id, oldRevisions.map((revision) => revision.id)));
}

export const contentRoutes: Route[] = [
  { method: "GET", pattern: "admin/site-pages", handler: async () => { await requireApi("SETTINGS_MANAGE"); return db.select().from(contentPages).where(isNull(contentPages.deletedAt)).orderBy(desc(contentPages.updatedAt)); } },
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
    if (old.deletedAt) throw new HttpError(404, "صفحه پیدا نشد");
    if (old.slug === "home") throw new HttpError(400, "صفحه اصلی را از صفحه‌ساز پیشرفته مدیریت کنید");
    if (b.delete === true) {
      if (["home", "about", "contact"].includes(old.slug)) throw new HttpError(409, "صفحه‌های اصلی درباره ما و تماس با ما قابل انتقال به زباله نیستند");
      const now = new Date();
      await db.update(contentPages).set({ status: "draft", deletedAt: now, deletedBy: user.id, deletedFromStatus: old.status, updatedAt: now }).where(eq(contentPages.id, id));
      await audit(db, { userId: user.id, ...meta }, "site_page.trash", "content_page", id, { title: old.title, slug: old.slug, status: old.status }, { deletedAt: now });
      return { ok: true };
    }
    const values = pageValues(b);
    const changed = JSON.stringify(pageDocument(old)) !== JSON.stringify(values);
    await db.transaction(async (tx) => {
      if (changed) await preservePageRevision(tx, old, user.id);
      await tx.update(contentPages).set({ ...values, updatedAt: new Date() }).where(eq(contentPages.id, id));
    });
    await audit(db, { userId: user.id, ...meta }, "site_page.update", "content_page", id, { title: old.title, slug: old.slug, status: old.status }, { title: values.title, slug: values.slug, status: values.status });
    return { ok: true, id, ...values };
  } },
  { method: "GET", pattern: "admin/site-pages/:id/revisions", handler: async (_req, p) => {
    await requireApi("SETTINGS_MANAGE"); const id = idParam(p.id);
    const [page] = await db.select({ id: contentPages.id }).from(contentPages).where(eq(contentPages.id, id));
    if (!page) throw new HttpError(404, "صفحه یافت نشد");
    return db.select().from(contentPageRevisions).where(eq(contentPageRevisions.pageId, id)).orderBy(desc(contentPageRevisions.createdAt), desc(contentPageRevisions.id)).limit(20);
  } },
  { method: "POST", pattern: "admin/site-pages/:id/restore/:revisionId", handler: async (req, p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(p.id), revisionId = idParam(p.revisionId);
    const [old] = await db.select().from(contentPages).where(eq(contentPages.id, id));
    if (!old || old.deletedAt) throw new HttpError(404, "صفحه یافت نشد");
    if (old.slug === "home") throw new HttpError(400, "صفحه اصلی را از صفحه‌ساز پیشرفته مدیریت کنید");
    const [revision] = await db.select().from(contentPageRevisions).where(sql`${contentPageRevisions.id} = ${revisionId} and ${contentPageRevisions.pageId} = ${id}`);
    if (!revision) throw new HttpError(404, "نسخهٔ انتخاب‌شده یافت نشد");
    const restored = { ...revision.document, status: "draft" as const };
    await db.transaction(async (tx) => {
      await preservePageRevision(tx, old, user.id);
      await tx.update(contentPages).set({ ...restored, updatedAt: new Date() }).where(eq(contentPages.id, id));
    });
    await audit(db, { userId: user.id, ...meta }, "site_page.restore", "content_page", id, { title: old.title, slug: old.slug, status: old.status }, { title: restored.title, slug: restored.slug, status: "draft", revisionId });
    return { ok: true, id, ...restored };
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
    const values = postValues(await body(req), user.permissions.includes("BLOG_PUBLISH"));
    await validateBlogMedia(values, values.status === "published" || values.status === "in_review");
    await syncTaxonomy(values.category, values.tags);
    const [post] = await db.insert(blogPosts).values({ ...values, authorId: user.id, publishedAt: values.status === "published" ? new Date() : null }).returning();
    await audit(db, { userId: user.id, ...meta }, "blog.create", "blog_post", post.id, null, { title: post.title, status: post.status });
    return post;
  } },
  { method: "POST", pattern: "admin/blog/:id", handler: async (req, p, meta) => {
    const user = await requireApi();
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    if (!old || old.deletedAt) throw new HttpError(404, "نوشته یافت نشد");
    if (b.reviewAction === "approve" || b.reviewAction === "request_changes") {
      if (!user.permissions.includes("BLOG_PUBLISH")) throw new HttpError(403, "دسترسی بازبینی و انتشار مقاله را ندارید");
      if (old.status !== "in_review") throw new HttpError(409, "این مقاله در صف بازبینی نیست");
      const now = new Date();
      const reviewNote = str(b.reviewNote, 1000) || null;
      if (b.reviewAction === "request_changes" && !reviewNote) throw new HttpError(400, "برای درخواست اصلاح، توضیح بازبینی الزامی است");
      const status = b.reviewAction === "approve" ? "published" : "draft";
      await db.update(blogPosts).set({ status, reviewNote, reviewedBy: user.id, reviewedAt: now, publishedAt: status === "published" ? old.publishedAt ?? now : null, updatedAt: now }).where(eq(blogPosts.id, id));
      await audit(db, { userId: user.id, ...meta }, b.reviewAction === "approve" ? "blog.approve" : "blog.request_changes", "blog_post", id, { status: old.status }, { status, reviewNote });
      return { ok: true, id, status, reviewNote };
    }
    if (!user.permissions.includes("PRODUCTS_EDIT")) throw new HttpError(403, "دسترسی ویرایش مقاله را ندارید");
    const canReview = user.permissions.includes("BLOG_PUBLISH");
    if (!canReview && old.authorId !== user.id) throw new HttpError(404, "نوشته یافت نشد");
    if (b.delete === true) {
      const now = new Date();
      await db.update(blogPosts).set({ status: "draft", deletedAt: now, deletedBy: user.id, deletedFromStatus: old.status, updatedAt: now }).where(eq(blogPosts.id, id));
      await audit(db, { userId: user.id, ...meta }, "blog.trash", "blog_post", id, { title: old.title, status: old.status }, { deletedAt: now });
      return { ok: true };
    }
    const values = postValues(b, canReview);
    await validateBlogMedia(values, values.status === "published" || values.status === "in_review");
    await syncTaxonomy(values.category, values.tags);
    const patch = { ...values, reviewNote: values.status === "in_review" ? null : old.reviewNote, publishedAt: values.status === "published" ? old.publishedAt ?? new Date() : null, updatedAt: new Date() };
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
    const [row] = await db.insert(blogTags).values({ name, slug, seoTitle: str(b.seoTitle, 160) || null, metaDescription: str(b.metaDescription, 320) || null, seoKeywords: str(b.seoKeywords, 500) || null, canonicalUrl: str(b.canonicalUrl, 500) || null }).returning();
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
    const seo = { seoTitle: str(b.seoTitle, 160) || null, metaDescription: str(b.metaDescription, 320) || null, seoKeywords: str(b.seoKeywords, 500) || null, canonicalUrl: str(b.canonicalUrl, 500) || null };
    await db.transaction(async (tx) => {
      await tx.update(blogTags).set({ name, slug, ...seo, updatedAt: new Date() }).where(eq(blogTags.id, id));
      if (name !== old.name) for (const post of affected) await tx.update(blogPosts).set({ tags: post.tags.map((tag) => tag === old.name ? name : tag), updatedAt: new Date() }).where(eq(blogPosts.id, post.id));
    });
    await audit(db, { userId: user.id, ...meta }, "blog.tag.update", "blog_tag", id, old, { name, slug, ...seo });
    return { ok: true };
  } },
];
