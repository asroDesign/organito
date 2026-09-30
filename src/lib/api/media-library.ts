import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, mediaFolders } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { HttpError, int, slugify, str } from "../util";
import { body, idParam, type Route } from "./router";
import { removeMediaFile } from "../media-storage";

async function folderExists(id: number | null) {
  if (!id) return;
  const [folder] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(eq(mediaFolders.id, id));
  if (!folder) throw new HttpError(400, "پوشه انتخاب‌شده وجود ندارد");
}

export const mediaLibraryRoutes: Route[] = [
  { method: "POST", pattern: "admin/media/folders", handler: async (req, _p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), b = await body(req), name = str(b.name, 100), parentId = b.parentId ? int(b.parentId, 1) : null;
    if (!name) throw new HttpError(400, "نام پوشه الزامی است");
    await folderExists(parentId);
    const [row] = await db.insert(mediaFolders).values({ name, slug: slugify(str(b.slug, 100) || name), parentId, color: str(b.color, 20) || null, createdBy: user.id }).returning();
    await audit(db, { userId: user.id, ...meta }, "media.folder.create", "media_folder", row.id, null, row);
    return row;
  } },
  { method: "POST", pattern: "admin/media/folders/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, id));
    if (!old) throw new HttpError(404, "پوشه یافت نشد");
    if (b.delete === true) {
      const [[child], [file]] = await Promise.all([
        db.select({ id: mediaFolders.id }).from(mediaFolders).where(eq(mediaFolders.parentId, id)).limit(1),
        db.select({ id: media.id }).from(media).where(eq(media.folderId, id)).limit(1),
      ]);
      if (child || file) throw new HttpError(409, "پوشه خالی نیست؛ ابتدا محتویات آن را منتقل یا حذف کنید");
      await db.delete(mediaFolders).where(eq(mediaFolders.id, id));
      await audit(db, { userId: user.id, ...meta }, "media.folder.delete", "media_folder", id, old, null);
      return { ok: true };
    }
    const name = str(b.name, 100), parentId = b.parentId ? int(b.parentId, 1) : null;
    if (!name || parentId === id) throw new HttpError(400, "مشخصات پوشه معتبر نیست");
    await folderExists(parentId);
    const [row] = await db.update(mediaFolders).set({ name, slug: slugify(str(b.slug, 100) || name), parentId, color: str(b.color, 20) || null, updatedAt: new Date() }).where(eq(mediaFolders.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "media.folder.update", "media_folder", id, old, row);
    return row;
  } },
  { method: "POST", pattern: "admin/media/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(media).where(eq(media.id, id));
    if (!old) throw new HttpError(404, "فایل یافت نشد");
    if (b.delete === true) {
      const used = await db.execute(sql`select exists(
        select 1 from product_images where media_id=${id}
        union all select 1 from products where video_media_id=${id}
        union all select 1 from blog_posts where cover_image_id=${id}
        union all select 1 from seller_documents where media_id=${id}
        union all select 1 from ticket_messages where media_id=${id}
        union all select 1 from payments where receipt_media_id=${id}
      ) as used`);
      if ((used.rows[0] as { used: boolean }).used) throw new HttpError(409, "این فایل در بخشی از سایت استفاده شده و قابل حذف نیست");
      await db.delete(media).where(eq(media.id, id));
      await removeMediaFile(old.storagePath);
      await audit(db, { userId: user.id, ...meta }, "media.delete", "media", id, { filename: old.filename }, null);
      return { ok: true };
    }
    const folderId = b.folderId ? int(b.folderId, 1) : null;
    await folderExists(folderId);
    const filename = str(b.filename, 190).replace(/[/\\]/g, "_");
    if (!filename) throw new HttpError(400, "نام فایل الزامی است");
    const [row] = await db.update(media).set({ filename, alt: str(b.alt, 190) || null, folderId, isPublic: b.isPublic === true, updatedAt: new Date() }).where(and(eq(media.id, id))).returning();
    await audit(db, { userId: user.id, ...meta }, "media.update", "media", id, { filename: old.filename, folderId: old.folderId }, { filename: row.filename, folderId: row.folderId });
    return row;
  } },
];
