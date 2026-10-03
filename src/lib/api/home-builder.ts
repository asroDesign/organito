import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentPages, homeBuilderState, type HomeBuilderRevision } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { HttpError, str } from "../util";
import { normalizeDocument } from "../page-builder";
import { listShopProducts } from "../queries";
import { getHomeBuilderState } from "../home-builder-state";
import { body, type Route } from "./router";

export const homeBuilderRoutes: Route[] = [
  { method: "GET", pattern: "admin/home-builder", handler: async () => { await requireApi("SETTINGS_MANAGE"); return getHomeBuilderState(); } },
  { method: "GET", pattern: "admin/home-builder/products", handler: async req => {
    await requireApi("SETTINGS_MANAGE");
    return listShopProducts({ q: str(req.nextUrl.searchParams.get("q"), 100) }, 40);
  } },
  { method: "POST", pattern: "admin/home-builder", handler: async (req, _p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), b = await body(req);
    if (!["save", "publish"].includes(String(b.action))) throw new HttpError(400, "عملیات نامعتبر است");
    const document = normalizeDocument(b.document);
    if (b.action === "publish" && !document.blocks.some(block => block.enabled !== false && !(block.style?.hideDesktop && block.style?.hideMobile))) throw new HttpError(400, "برای انتشار حداقل یک بخش قابل نمایش لازم است");
    const state = await db.transaction(async tx => {
      const [old] = await tx.select().from(homeBuilderState).where(eq(homeBuilderState.id, 1)).for("update");
      if (!old || Number(b.version) !== old.version) throw new HttpError(409, "نسخه جدیدتری ذخیره شده است. تغییرات خود را خروجی بگیرید و صفحه را تازه‌سازی کنید.");
      let revisions = old.revisions;
      if (b.action === "publish") {
        const [current] = await tx.select().from(contentPages).where(eq(contentPages.slug, "home"));
        if (current) {
          const revision: HomeBuilderRevision = { id: crypto.randomUUID(), at: new Date().toISOString(), userId: user.id, document: { title: current.title, metaTitle: current.metaTitle || "", metaDescription: current.metaDescription || "", blocks: current.blocks } };
          revisions = [revision, ...revisions].slice(0, 20);
        }
        const values = { title: document.title, metaTitle: document.metaTitle || null, metaDescription: document.metaDescription || null, blocks: document.blocks, status: "published", updatedAt: new Date() };
        await tx.insert(contentPages).values({ ...values, slug: "home", template: "nature", createdBy: user.id }).onConflictDoUpdate({ target: contentPages.slug, set: values });
      }
      const [saved] = await tx.update(homeBuilderState).set({ draft: document, revisions, version: sql`${homeBuilderState.version} + 1`, updatedAt: new Date() }).where(eq(homeBuilderState.id, 1)).returning();
      await audit(tx, { userId: user.id, ...meta }, `home_builder.${b.action}`, "home_page", 1, { version: old.version }, { version: saved.version, sections: document.blocks.length });
      return saved;
    });
    if (b.action === "publish") revalidatePath("/");
    return state;
  } },
];
