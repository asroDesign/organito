import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { siteMenuItems, siteMenus } from "@/db/schema";

export type SiteMenuItem = typeof siteMenuItems.$inferSelect & { children: SiteMenuItem[] };
export type SiteMenuData = { enabled: boolean; items: SiteMenuItem[] } | null;
export async function getSiteMenu(placement: "header" | "footer" | "mobile") {
  const [menu] = await db.select().from(siteMenus).where(eq(siteMenus.placement, placement)).limit(1);
  if (!menu) return null as SiteMenuData;
  if (!menu.enabled) return { enabled: false, items: [] } as SiteMenuData;
  const rows = await db.select().from(siteMenuItems).where(and(eq(siteMenuItems.menuId, menu.id), eq(siteMenuItems.enabled, true), isNull(siteMenuItems.deletedAt))).orderBy(asc(siteMenuItems.sortOrder), asc(siteMenuItems.id));
  const nodes = new Map<number, SiteMenuItem>();
  for (const row of rows) nodes.set(row.id, { ...row, children: [] });
  const roots: SiteMenuItem[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return { enabled: true, items: roots } as SiteMenuData;
}
