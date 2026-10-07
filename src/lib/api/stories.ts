import { createHash } from "crypto";
import { and, desc, eq, gt, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, products, stories, storyInteractions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireApi, rateLimit } from "@/lib/auth";
import { getActiveStories } from "@/lib/stories";
import { HttpError, int, str } from "@/lib/util";
import { body, idParam, type Route } from "./router";

type StoryDraft = {
  title: string; caption: string | null; mediaId: number; mediaType: "image" | "video";
  productId: number | null; href: string | null; ctaLabel: string | null;
  status: "draft" | "published" | "archived"; startsAt: Date | null; endsAt: Date | null; sortOrder: number;
};

function optionalDate(value: unknown, label: string) {
  const raw = str(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, `${label} معتبر نیست`);
  return date;
}

function parseDraft(value: Record<string, unknown>): StoryDraft {
  const title = str(value.title, 100).trim();
  const mediaId = int(value.mediaId, 1);
  const mediaType = value.mediaType === "video" ? "video" : value.mediaType === "image" ? "image" : null;
  const status = ["draft", "published", "archived"].includes(String(value.status)) ? String(value.status) as StoryDraft["status"] : "draft";
  const productId = value.productId ? int(value.productId, 1) : null;
  const startsAt = optionalDate(value.startsAt, "زمان شروع"), endsAt = optionalDate(value.endsAt, "زمان پایان");
  if (title.length < 2) throw new HttpError(400, "عنوان استوری باید دست‌کم دو نویسه باشد");
  if (!mediaType) throw new HttpError(400, "نوع رسانه معتبر نیست");
  if (startsAt && endsAt && endsAt <= startsAt) throw new HttpError(400, "زمان پایان باید بعد از زمان شروع باشد");
  let href: string | null = null;
  const rawHref = str(value.href, 500).trim();
  if (rawHref) {
    if (rawHref.startsWith("/") && !rawHref.startsWith("//") && !/[\r\n]/.test(rawHref)) href = rawHref;
    else {
      try { const url = new URL(rawHref); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(); href = url.toString(); }
      catch { throw new HttpError(400, "پیوند استوری باید نشانی معتبر داخلی یا http/https باشد"); }
    }
  }
  return { title, caption: str(value.caption, 500) || null, mediaId, mediaType, productId, href, ctaLabel: str(value.ctaLabel, 40) || null, status, startsAt, endsAt, sortOrder: int(value.sortOrder ?? 0, 0, 10000) };
}

async function validateDraft(draft: StoryDraft) {
  const [asset] = await db.select({ id: media.id, mime: media.mime }).from(media).where(eq(media.id, draft.mediaId));
  if (!asset || (draft.mediaType === "image" ? !asset.mime.startsWith("image/") : !asset.mime.startsWith("video/"))) throw new HttpError(400, "فایل انتخاب‌شده با نوع رسانه استوری سازگار نیست");
  if (draft.productId) {
    const [product] = await db.select({ id: products.id, status: products.status }).from(products).where(eq(products.id, draft.productId));
    if (!product || !["active", "out_of_stock"].includes(product.status)) throw new HttpError(400, "محصول انتخاب‌شده منتشرشده نیست");
  }
}

export const storyRoutes: Route[] = [
  { method: "GET", pattern: "admin/stories", handler: async (req) => {
    await requireApi("SETTINGS_MANAGE");
    const q = str(req.nextUrl.searchParams.get("q"), 100);
    const rows = await db.select({ story: stories, productName: products.nameFa }).from(stories).leftJoin(products, eq(products.id, stories.productId)).where(q ? ilike(stories.title, `%${q}%`) : undefined).orderBy(desc(stories.updatedAt)).limit(200);
    return rows.map(({ story, productName }) => ({ ...story, productName }));
  } },
  { method: "POST", pattern: "admin/stories", handler: async (req, _p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), draft = parseDraft(await body(req));
    await validateDraft(draft);
    const [row] = await db.insert(stories).values({ ...draft, createdBy: user.id }).returning();
    if (draft.status === "published") await db.update(media).set({ isPublic: true }).where(eq(media.id, draft.mediaId));
    await audit(db, { userId: user.id, ...meta }, "story.create", "story", row.id, null, row);
    return row;
  } },
  { method: "PUT", pattern: "admin/stories/:id", handler: async (req, params, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(params.id), draft = parseDraft(await body(req));
    await validateDraft(draft);
    const [old] = await db.select().from(stories).where(eq(stories.id, id));
    if (!old) throw new HttpError(404, "استوری پیدا نشد");
    const [row] = await db.update(stories).set({ ...draft, updatedAt: new Date() }).where(eq(stories.id, id)).returning();
    if (draft.status === "published") await db.update(media).set({ isPublic: true }).where(eq(media.id, draft.mediaId));
    await audit(db, { userId: user.id, ...meta }, "story.update", "story", row.id, old, row);
    return row;
  } },
  { method: "DELETE", pattern: "admin/stories/:id", handler: async (req, params, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(params.id);
    const [old] = await db.select().from(stories).where(eq(stories.id, id));
    if (!old) throw new HttpError(404, "استوری پیدا نشد");
    const [row] = await db.update(stories).set({ status: "archived", updatedAt: new Date() }).where(eq(stories.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "story.archive", "story", row.id, old, row);
    return { ok: true };
  } },
  { method: "GET", pattern: "stories", handler: async () => {
    const rows = await getActiveStories();
    return rows.map(({ story, productName, productSlug }) => ({ ...story, productName, productSlug }));
  } },
  { method: "POST", pattern: "stories/:id/interaction", handler: async (req, params, meta) => {
    const id = idParam(params.id), payload = await body(req), action = payload.action;
    const visitorKey = str(payload.visitorKey, 80);
    if (!/^[a-f\d-]{32,80}$/i.test(visitorKey)) throw new HttpError(400, "شناسه بازدید معتبر نیست");
    if (action !== "view" && action !== "toggle_like") throw new HttpError(400, "نوع تعامل معتبر نیست");
    rateLimit(`story-interaction:${meta.ip}:${id}`, 120, 60_000);
    const visitorHash = createHash("sha256").update(`${process.env.AUTH_SECRET ?? "anonymous-story"}:${id}:${visitorKey}`).digest("hex");
    return db.transaction(async (tx) => {
      const now = new Date();
      const [story] = await tx.select().from(stories).where(and(
        eq(stories.id, id), eq(stories.status, "published"),
        or(isNull(stories.startsAt), lte(stories.startsAt, now)), or(isNull(stories.endsAt), gt(stories.endsAt, now)),
      )).for("update");
      if (!story) throw new HttpError(404, "استوری فعال پیدا نشد");
      if (action === "view") {
        const [inserted] = await tx.insert(storyInteractions).values({ storyId: id, visitorHash }).onConflictDoNothing({ target: [storyInteractions.storyId, storyInteractions.visitorHash] }).returning({ id: storyInteractions.id });
        const [counts] = inserted
          ? await tx.update(stories).set({ viewCount: sql`${stories.viewCount} + 1` }).where(eq(stories.id, id)).returning({ views: stories.viewCount, likes: stories.likeCount })
          : [{ views: story.viewCount, likes: story.likeCount }];
        const [interaction] = await tx.select({ liked: storyInteractions.liked }).from(storyInteractions).where(and(eq(storyInteractions.storyId, id), eq(storyInteractions.visitorHash, visitorHash))).limit(1);
        return { ...counts, liked: interaction?.liked ?? false };
      }
      const [inserted] = await tx.insert(storyInteractions).values({ storyId: id, visitorHash }).onConflictDoNothing({ target: [storyInteractions.storyId, storyInteractions.visitorHash] }).returning({ id: storyInteractions.id });
      const [interaction] = await tx.select().from(storyInteractions).where(and(eq(storyInteractions.storyId, id), eq(storyInteractions.visitorHash, visitorHash))).for("update");
      const liked = !interaction.liked;
      await tx.update(storyInteractions).set({ liked, likedAt: liked ? now : null }).where(eq(storyInteractions.id, interaction.id));
      const [counts] = await tx.update(stories).set({ viewCount: inserted ? sql`${stories.viewCount} + 1` : stories.viewCount, likeCount: sql`greatest(${stories.likeCount} + ${liked ? 1 : -1}, 0)` }).where(eq(stories.id, id)).returning({ views: stories.viewCount, likes: stories.likeCount });
      return { ...counts, liked };
    });
  } },
];
