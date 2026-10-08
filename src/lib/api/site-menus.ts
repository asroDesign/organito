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
  const all = parentId || id
    ? await db.select({ id: siteMenuItems.id, parentId: siteMenuItems.parentId }).from(siteMenuItems).where(and(eq(siteMenuItems.menuId, menuId), isNull(siteMenuItems.deletedAt)))
    : [];
  const itemById = new Map(all.map((item) => [item.id, item]));
  let parentDepth = 0, cursor = parentId;
  const seen = new Set<number>(id ? [id] : []);
  while (cursor !== null) {
    if (seen.has(cursor)) throw new HttpError(400, "ساختار والدها چرخه ایجاد می‌کند");
    const parent = itemById.get(cursor);
    if (!parent) throw new HttpError(400, "والد انتخاب‌شده در همین منو وجود ندارد");
    seen.add(cursor); parentDepth++; cursor = parent.parentId;
  }
  if (id) {
    const relativeDepth = new Map<number, number>([[id, 0]]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of all) if (item.parentId !== null && relativeDepth.has(item.parentId) && !relativeDepth.has(item.id)) {
        relativeDepth.set(item.id, relativeDepth.get(item.parentId)! + 1); changed = true;
      }
    }
    const descendantHeight = Math.max(0, ...relativeDepth.values());
    if ((parentId ? parentDepth + 1 : 1) + descendantHeight > 3) throw new HttpError(400, "حداکثر سه سطح زیرمنو مجاز است");
  } else if (parentId && parentDepth >= 3) {
    throw new HttpError(400, "حداکثر سه سطح زیرمنو مجاز است");
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
      await db.transaction(async (tx) => {
        await tx.update(siteMenus).set({ enabled, updatedAt: new Date() }).where(eq(siteMenus.id, menu.id));
        await audit(tx, { userId: user.id, ...meta }, "site_menu.toggle", "site_menu", menu.id, { enabled: menu.enabled }, { enabled });
      });
      revalidatePath("/");
      return { ok: true, enabled };
    }
    const values = await itemValues(b, menu.id);
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(siteMenuItems).values({ ...values, menuId: menu.id }).returning();
      await audit(tx, { userId: user.id, ...meta }, "site_menu_item.create", "site_menu_item", created.id, null, created);
      return created;
    });
    revalidatePath("/");
    return row;
  } },
  { method: "POST", pattern: "admin/site-menus/reorder", handler: async (req, _p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), b = await body(req), placement = String(b.placement);
    if (!placements.includes(placement as typeof placements[number])) throw new HttpError(400, "جایگاه منو معتبر نیست");
    if (!Array.isArray(b.ids) || b.ids.length > 200 || !b.ids.every((value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0)) throw new HttpError(400, "ترتیب آیتم‌ها معتبر نیست");
    const ids = b.ids as number[];
    if (new Set(ids).size !== ids.length) throw new HttpError(400, "آیتم تکراری در ترتیب منو وجود دارد");
    const parentId = b.parentId === null || b.parentId === undefined ? null : int(b.parentId, 1);
    const [menu] = await db.select().from(siteMenus).where(eq(siteMenus.placement, placement));
    if (!menu) throw new HttpError(404, "جایگاه منو پیدا نشد");
    const siblings = await db.select({ id: siteMenuItems.id, sortOrder: siteMenuItems.sortOrder }).from(siteMenuItems)
      .where(and(eq(siteMenuItems.menuId, menu.id), parentId === null ? isNull(siteMenuItems.parentId) : eq(siteMenuItems.parentId, parentId), isNull(siteMenuItems.deletedAt)))
      .orderBy(asc(siteMenuItems.sortOrder), asc(siteMenuItems.id));
    const expected = siblings.map((item) => item.id);
    if (expected.length !== ids.length || expected.some((id) => !ids.includes(id))) throw new HttpError(409, "فهرست منو تغییر کرده است؛ صفحه را تازه‌سازی کنید");
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.update(siteMenuItems).set({ sortOrder: index * 10, updatedAt: now }).where(and(eq(siteMenuItems.id, id), eq(siteMenuItems.menuId, menu.id), isNull(siteMenuItems.deletedAt)));
      }
      await audit(tx, { userId: user.id, ...meta }, "site_menu_item.reorder", "site_menu", menu.id, expected, ids);
    });
    revalidatePath("/");
    return { ok: true, ids };
  } },
  { method: "POST", pattern: "admin/site-menu-items/:id", handler: async (req, p, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(siteMenuItems).where(and(eq(siteMenuItems.id, id), isNull(siteMenuItems.deletedAt)));
    if (!old) throw new HttpError(404, "آیتم منو پیدا نشد");
    if (b.delete === true) {
      const now = new Date();
      await db.transaction(async (tx) => {
        const rows = await tx.select({ id: siteMenuItems.id, parentId: siteMenuItems.parentId }).from(siteMenuItems).where(and(eq(siteMenuItems.menuId, old.menuId), isNull(siteMenuItems.deletedAt)));
        const removed = new Set([id]);
        let changed = true;
        while (changed) { changed = false; for (const row of rows) if (row.parentId && removed.has(row.parentId) && !removed.has(row.id)) { removed.add(row.id); changed = true; } }
        await tx.update(siteMenuItems).set({ enabled: false, deletedAt: now, updatedAt: now }).where(inArray(siteMenuItems.id, [...removed]));
        await audit(tx, { userId: user.id, ...meta }, "site_menu_item.trash", "site_menu_item", id, old, { deletedAt: now, removedIds: [...removed] });
      });
      revalidatePath("/");
      return { ok: true };
    }
    const values = await itemValues(b, old.menuId, id);
    const row = await db.transaction(async (tx) => {
      const [updated] = await tx.update(siteMenuItems).set(values).where(eq(siteMenuItems.id, id)).returning();
      await audit(tx, { userId: user.id, ...meta }, "site_menu_item.update", "site_menu_item", id, old, updated);
      return updated;
    });
    revalidatePath("/");
    return row;
  } },
];
