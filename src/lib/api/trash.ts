import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, brands, contentPages, products } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireApi } from "@/lib/auth";
import { HttpError } from "@/lib/util";
import { body, idParam, type Route } from "./router";

function canProducts(user: Awaited<ReturnType<typeof requireApi>>) {
  return user.permissions.includes("PRODUCTS_EDIT");
}

function canManageProductStatus(user: Awaited<ReturnType<typeof requireApi>>) {
  return canProducts(user) || user.permissions.includes("PRODUCTS_DISABLE");
}

function canSettings(user: Awaited<ReturnType<typeof requireApi>>) {
  return user.permissions.includes("SETTINGS_MANAGE");
}

export const trashRoutes: Route[] = [
  { method: "GET", pattern: "admin/trash", handler: async () => {
    const user = await requireApi();
    if (!canManageProductStatus(user) && !canSettings(user)) throw new HttpError(403, "دسترسی غیرمجاز");
    const rows: { kind: string; id: number; title: string; detail: string; deletedAt: Date | null; deletedBy: number | null }[] = [];
    if (canManageProductStatus(user)) {
      const productRows = await db.select({ id: products.id, title: products.nameFa, detail: products.sku, deletedAt: products.deletedAt, deletedBy: products.deletedBy }).from(products).where(eq(products.status, "deleted")).orderBy(desc(products.deletedAt)).limit(200);
      rows.push(...productRows.map((row) => ({ ...row, kind: "product" })));
    }
    if (canProducts(user)) {
      const [postRows, brandRows] = await Promise.all([
        db.select({ id: blogPosts.id, title: blogPosts.title, detail: blogPosts.slug, deletedAt: blogPosts.deletedAt, deletedBy: blogPosts.deletedBy }).from(blogPosts).where(isNotNull(blogPosts.deletedAt)).orderBy(desc(blogPosts.deletedAt)).limit(200),
        db.select({ id: brands.id, title: brands.name, detail: brands.slug, deletedAt: brands.deletedAt, deletedBy: brands.deletedBy }).from(brands).where(isNotNull(brands.deletedAt)).orderBy(desc(brands.deletedAt)).limit(200),
      ]);
      rows.push(...postRows.map((row) => ({ ...row, kind: "blog" })), ...brandRows.map((row) => ({ ...row, kind: "brand" })));
    }
    if (canSettings(user)) {
      const pageRows = await db.select({ id: contentPages.id, title: contentPages.title, detail: contentPages.slug, deletedAt: contentPages.deletedAt, deletedBy: contentPages.deletedBy }).from(contentPages).where(isNotNull(contentPages.deletedAt)).orderBy(desc(contentPages.deletedAt)).limit(200);
      rows.push(...pageRows.map((row) => ({ ...row, kind: "page" })));
    }
    return rows.sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)).slice(0, 500);
  } },
  { method: "POST", pattern: "admin/trash/:kind/:id/restore", handler: async (req, p, meta) => {
    const user = await requireApi(), id = idParam(p.id), b = await body(req);
    if (b.confirm !== true) throw new HttpError(400, "بازیابی باید صریحاً تأیید شود");
    const now = new Date();
    if (p.kind === "product") {
      if (!canManageProductStatus(user)) throw new HttpError(403, "دسترسی بازیابی محصولات ندارید");
      return db.transaction(async (tx) => {
        const [old] = await tx.select().from(products).where(and(eq(products.id, id), eq(products.status, "deleted"))).for("update");
        if (!old) throw new HttpError(404, "محصول حذف‌شده پیدا نشد");
        const candidates = new Set(["draft", "pending", "approved", "active", "inactive", "out_of_stock", "rejected", "suspended"]);
        const status = old.deletedFromStatus && candidates.has(old.deletedFromStatus) ? old.deletedFromStatus : "draft";
        const [row] = await tx.update(products).set({ status, deletedAt: null, deletedBy: null, deletedFromStatus: null, updatedAt: now }).where(eq(products.id, id)).returning();
        await audit(tx, { userId: user.id, ...meta }, "product.restore", "product", id, { status: old.status }, { status: row.status });
        return { ok: true, status: row.status };
      });
    }
    if (p.kind === "blog") {
      if (!canProducts(user)) throw new HttpError(403, "دسترسی بازیابی مقاله ندارید");
      return db.transaction(async (tx) => {
        const [old] = await tx.select().from(blogPosts).where(and(eq(blogPosts.id, id), isNotNull(blogPosts.deletedAt))).for("update");
        if (!old) throw new HttpError(404, "مقاله حذف‌شده پیدا نشد");
        const status = old.deletedFromStatus === "published" ? "published" : "draft";
        await tx.update(blogPosts).set({ status, deletedAt: null, deletedBy: null, deletedFromStatus: null, updatedAt: now }).where(eq(blogPosts.id, id));
        await audit(tx, { userId: user.id, ...meta }, "blog.restore", "blog_post", id, { title: old.title, deletedAt: old.deletedAt }, { title: old.title, status });
        return { ok: true, status };
      });
    }
    if (p.kind === "brand") {
      if (!canProducts(user)) throw new HttpError(403, "دسترسی بازیابی برند ندارید");
      return db.transaction(async (tx) => {
        const [old] = await tx.select().from(brands).where(and(eq(brands.id, id), isNotNull(brands.deletedAt))).for("update");
        if (!old) throw new HttpError(404, "برند حذف‌شده پیدا نشد");
        await tx.update(brands).set({ isActive: old.deletedWasActive ?? false, deletedAt: null, deletedBy: null, deletedWasActive: null, updatedAt: now }).where(eq(brands.id, id));
        await audit(tx, { userId: user.id, ...meta }, "brand.restore", "brand", id, { name: old.name, deletedAt: old.deletedAt }, { name: old.name, isActive: old.deletedWasActive ?? false });
        return { ok: true };
      });
    }
    if (p.kind === "page") {
      if (!canSettings(user)) throw new HttpError(403, "دسترسی بازیابی صفحات ندارید");
      return db.transaction(async (tx) => {
        const [old] = await tx.select().from(contentPages).where(and(eq(contentPages.id, id), isNotNull(contentPages.deletedAt))).for("update");
        if (!old) throw new HttpError(404, "صفحه حذف‌شده پیدا نشد");
        if (["home", "about", "contact"].includes(old.slug)) throw new HttpError(409, "صفحه اصلی درباره ما و تماس با ما از این مسیر بازیابی نمی‌شود");
        const status = old.deletedFromStatus === "published" ? "published" : "draft";
        await tx.update(contentPages).set({ status, deletedAt: null, deletedBy: null, deletedFromStatus: null, updatedAt: now }).where(eq(contentPages.id, id));
        await audit(tx, { userId: user.id, ...meta }, "site_page.restore", "content_page", id, { title: old.title, deletedAt: old.deletedAt }, { title: old.title, status });
        return { ok: true, status };
      });
    }
    throw new HttpError(404, "نوع محتوای حذف‌شده معتبر نیست");
  } },
];
