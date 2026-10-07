import { and, eq, lt, ne, notInArray, or, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { media, mediaFolders, mediaVariants } from "@/db/schema";
import { rateLimit, requireApi } from "../auth";
import { audit } from "../audit";
import { HttpError, int, slugify, str } from "../util";
import { body, idParam, type Route } from "./router";
import { readMediaFile, removeMediaFile } from "../media-storage";
import { createImageVariants, type ImageCropRatio, type ImageOutputFormat } from "../media-processing";

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
  { method: "POST", pattern: "admin/media/:id/process", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    rateLimit(`media-process:${user.id}`, 5, 60_000);
    const cropRatio = ["original", "1:1", "4:3", "16:9", "3:4"].includes(String(b.cropRatio)) ? String(b.cropRatio) as ImageCropRatio : "original";
    const format = ["webp", "avif", "both"].includes(String(b.format)) ? String(b.format) as ImageOutputFormat : "webp";
    const focalX = int(b.focalX ?? 50, 0, 100), focalY = int(b.focalY ?? 50, 0, 100), quality = int(b.quality ?? 80, 50, 95);
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const [source] = await db.update(media).set({ processingStatus: "processing", processingError: null, updatedAt: new Date() })
      .where(and(eq(media.id, id), or(ne(media.processingStatus, "processing"), lt(media.updatedAt, staleBefore)))).returning({ id: media.id, mime: media.mime, size: media.size, storagePath: media.storagePath, processingStatus: media.processingStatus });
    if (!source) {
      const [exists] = await db.select({ id: media.id }).from(media).where(eq(media.id, id));
      if (!exists) throw new HttpError(404, "فایل یافت نشد");
      throw new HttpError(409, "پردازش این تصویر در حال انجام است");
    }
    let variants: Awaited<ReturnType<typeof createImageVariants>> = [];
    try {
      if (!source.mime.startsWith("image/")) throw new HttpError(400, "پردازش فقط برای فایل‌های تصویری در دسترس است");
      if (source.size > 20 * 1024 * 1024) throw new HttpError(400, "برای جلوگیری از مصرف بیش از حد منابع، پردازش تصویرهای بزرگ‌تر از ۲۰ مگابایت ممکن نیست.");
      const input = await readMediaFile(source.storagePath);
      variants = await createImageVariants(id, input, { cropRatio, focalX, focalY, quality, format });
      const previous = await db.select({ storagePath: mediaVariants.storagePath }).from(mediaVariants).where(eq(mediaVariants.mediaId, id));
      const finishedAt = new Date();
      const nextNames = variants.map((variant) => variant.variant);
      await db.transaction(async (tx) => {
        await tx.delete(mediaVariants).where(and(eq(mediaVariants.mediaId, id), notInArray(mediaVariants.variant, nextNames)));
        for (const variant of variants) {
          await tx.insert(mediaVariants).values({ mediaId: id, ...variant }).onConflictDoUpdate({
            target: [mediaVariants.mediaId, mediaVariants.variant],
            set: { storagePath: variant.storagePath, mime: variant.mime, size: variant.size, width: variant.width, height: variant.height, cropRatio: variant.cropRatio, focalX: variant.focalX, focalY: variant.focalY, quality: variant.quality, createdAt: finishedAt },
          });
        }
        await tx.update(media).set({ processingStatus: "ready", processingError: null, processedAt: finishedAt, updatedAt: finishedAt }).where(eq(media.id, id));
      });
      const newPaths = new Set(variants.map((variant) => variant.storagePath));
      await Promise.all(previous.filter((variant) => !newPaths.has(variant.storagePath)).map((variant) => removeMediaFile(variant.storagePath)));
      await audit(db, { userId: user.id, ...meta }, "media.process", "media", id, { variants: previous.length }, { variants: variants.length, cropRatio, format, quality }).catch(() => undefined);
      return { ok: true, status: "ready", variants: variants.map(({ variant, mime, size, width, height }) => ({ variant, mime, size, width, height })), supportedAvif: Boolean(sharp.format.avif?.output?.file) };
    } catch (error) {
      await Promise.all(variants.map((variant) => removeMediaFile(variant.storagePath)));
      const message = error instanceof HttpError ? error.message : (error as Error).message || "خطای پردازش تصویر";
      await db.update(media).set({ processingStatus: "failed", processingError: message.slice(0, 300), updatedAt: new Date() }).where(eq(media.id, id));
      throw error;
    }
  } },
  { method: "POST", pattern: "admin/media/:id", handler: async (req, p, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(media).where(eq(media.id, id));
    if (!old) throw new HttpError(404, "فایل یافت نشد");
    if (b.delete === true) {
      const variants = await db.select({ storagePath: mediaVariants.storagePath }).from(mediaVariants).where(eq(mediaVariants.mediaId, id));
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
      await Promise.all([removeMediaFile(old.storagePath), ...variants.map((variant) => removeMediaFile(variant.storagePath))]);
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
