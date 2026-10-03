import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contentPages, homeBuilderState, type HomeBuilderDocument } from "@/db/schema";
import { DEFAULT_HOME_LAYOUT } from "./home-page-builder";
import { homeBuilderDefaults } from "./home-builder-defaults";
import { getSettings } from "./settings";

export async function getHomeBuilderState() {
  const [[page], [existing], settings] = await Promise.all([
    db.select().from(contentPages).where(eq(contentPages.slug, "home")),
    db.select().from(homeBuilderState).where(eq(homeBuilderState.id, 1)),
    getSettings(),
  ]);
  const source = page?.blocks?.length ? [...page.blocks] : [...DEFAULT_HOME_LAYOUT];
  // On first setup, carry every current storefront section into the visual draft
  // while retaining any customized blocks that were already on the homepage.
  if (!existing) {
    const present = new Set(source.filter(b => b.type === "store_section").map(b => b.sectionId));
    source.push(...DEFAULT_HOME_LAYOUT.filter(b => !present.has(b.sectionId)));
  }
  const initial: HomeBuilderDocument = {
    title: page?.title || "صفحه اصلی",
    metaTitle: page?.metaTitle || "",
    metaDescription: page?.metaDescription || "",
    blocks: homeBuilderDefaults(source, settings),
  };
  if (!existing) await db.insert(homeBuilderState).values({ id: 1, draft: initial }).onConflictDoNothing();
  const [state] = await db.select().from(homeBuilderState).where(eq(homeBuilderState.id, 1));
  return { ...state, published: page?.status === "published" ? { title: page.title, metaTitle: page.metaTitle || "", metaDescription: page.metaDescription || "", blocks: page.blocks } : null };
}
