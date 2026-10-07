import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { siteMenuItems, siteMenus } from "@/db/schema";
import { audit } from "../audit";
import { requireApi } from "../auth";
import { HttpError, int, str } from "../util";
import { body, idParam, type Route } from "./router";

const placements = ["header", "footer", "mobile"] as const;
const validHref = (href: string) => !href || (href.startsWith("/") && !href.startsWith("//")) || /^https:\/\//i.test(href);
async function itemValues(b: Record<string, unknown>, menuId: number, id?: number) {
  const label = str(b.label, 100).trim();
  const href = str(b.href, 500).trim();
  const parentId = b.parentId ? int(b.parentId, 1) : null;
  if (!label) throw new HttpError(400, "عنوان آیتم الزامی است");
  if (!validHref(href)) throw new HttpError(400, "نشانی باید داخلی یا HTTPS باشد");
  if (!href && !b.groupTitle && !parentId) throw new HttpError(400, "برای آیتم اصلی نشانی یا عنوان گروه لازم است");
  if (parentId) {
    const [parent] = await db.select().from(siteMenuItems).where(and(eq(siteMenuItems.id, parentId), eq(siteMenuItems.menuId, menuId), isNull(siteMenuItems.deletedAt)));
    if (!parent) throw new HttpError(400, "والد انتخاب‌شده در همین منو وجود ندارد");
    if (id && parentId === id) throw new HttpError(400, "آیتم نمی‌تواند والد خودش باشد");
    const all = await db.select({ id: siteMenuItems.id, parentId: siteMenuItems.parentId }).from(siteMenuItems).where(and(eq(siteMenuItems.menuId, menuId), isNull(siteMenuItems.deletedAt)));
    let depth = 1, cursor: number | null = parentId;
    const seen = new Set<number>(id ? [id] : []);
    while (cursor) {
      if (seen.has(cursor)) throw new HttpError(400, "ساختار والدها چرخه ایجاد می‌کند");
      seen.add(cursor);
      const row = all.find((x) => x.id === cursor);
      cursor = row?.parentId ?? null;
      if (cursor) depth++;
      if (depth > 3) throw new HttpError(400, "حداکثر سه سطح زیرمنو مجاز است");
    }
  }
  return { label, href: href || null, parentId, groupTitle: str(b.groupTitle, 60).trim() || null, sortOrder: int(b.sortOrder ?? 0, 0, 10000), enabled: b.enabled !== false, targetBlank: b.targetBlank === true, updatedAt: new Date() };
}

export const siteMenuRoutes: Route[] = [
  { method: "GET", pattern: "admin/site-menus", handler: async () => {
    await requireApi("SETTINGS_MANAGE");
    const [menus, items] = await Promise.all([db.select().from(siteMenus).orderBy(asc(siteMenus.id)), db.select().from(siteMenuItems).where(isNull(siteMenuItems.deletedAt)).orderBy(asc(siteMenuItems.sortOrder), asc(siteMenuItems.id))]);
    return menus.map((menu) => ({ ...menu, items: items.filter((item) => item.menuId === menu.id) }));
  } },
  { method: "POST", pattern: "admin/site-menus", handler: async (req, _p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), b = await body(req), placement = String(b.placement);
    if (!placements.includes(placement as typeof placements[number])) throw new HttpError(400, "جایگاه منو معتبر نیست");
    const [menu] = await db.select().from(siteMenus).where(eq(siteMenus.placement, placement));
    if (!menu) throw new HttpError(404, "جایگاه منو پیدا نشد");
    if (b.action === "toggle") {
      const enabled = b.enabled === true;
      await db.update(siteMenus).set({ enabled, updatedAt: new Date() }).where(eq(siteMenus.id, menu.id));
      await audit(db, { userId: user.id, ...meta }, "site_menu.toggle", "site_menu", menu.id, { enabled: menu.enabled }, { enabled });
      revalidatePath("/");
      return { ok: true, enabled };
    }
    const values = await itemValues(b, menu.id);
    const [row] = await db.insert(siteMenuItems).values({ ...values, menuId: menu.id }).returning();
    await audit(db, { userId: user.id, ...meta }, "site_menu_item.create", "site_menu_item", row.id, null, row);
    revalidatePath("/");
    return row;
  } },
  { method: "POST", pattern: "admin/site-menu-items/:id", handler: async (req, p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(siteMenuItems).where(and(eq(siteMenuItems.id, id), isNull(siteMenuItems.deletedAt)));
    if (!old) throw new HttpError(404, "آیتم منو پیدا نشد");
    if (b.delete === true) {
      const now = new Date();
      const rows = await db.select({ id: siteMenuItems.id, parentId: siteMenuItems.parentId }).from(siteMenuItems).where(and(eq(siteMenuItems.menuId, old.menuId), isNull(siteMenuItems.deletedAt)));
      const removed = new Set([id]);
      let changed = true;
      while (changed) { changed = false; for (const row of rows) if (row.parentId && removed.has(row.parentId) && !removed.has(row.id)) { removed.add(row.id); changed = true; } }
      await db.update(siteMenuItems).set({ enabled: false, deletedAt: now, updatedAt: now }).where(inArray(siteMenuItems.id, [...removed]));
      await audit(db, { userId: user.id, ...meta }, "site_menu_item.trash", "site_menu_item", id, old, { deletedAt: now });
      revalidatePath("/");
      return { ok: true };
    }
    const values = await itemValues(b, old.menuId, id);
    const [row] = await db.update(siteMenuItems).set(values).where(eq(siteMenuItems.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "site_menu_item.update", "site_menu_item", id, old, row);
    revalidatePath("/");
    return row;
  } },
];
