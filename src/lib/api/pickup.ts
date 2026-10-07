import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderHistory, pickupCenters, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireApi } from "@/lib/auth";
import { HttpError, int, str } from "@/lib/util";
import { body, idParam, type Route } from "./router";

const DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
function openingHours(value: unknown) {
  if (!Array.isArray(value) || value.length !== 7) throw new HttpError(400, "ساعت کاری باید برای هر هفت روز هفته مشخص شود");
  const result = value.map((raw) => {
    const item = raw as Record<string, unknown>;
    const day = Number(item.day), open = str(item.open, 5), close = str(item.close, 5), closed = item.closed === true;
    if (!DAYS.has(day) || (!closed && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close) || open >= close))) throw new HttpError(400, "ساعت باز و بسته‌شدن معتبر نیست");
    return { day, open, close, closed };
  });
  if (new Set(result.map((item) => item.day)).size !== 7) throw new HttpError(400, "روز تکراری یا جاافتاده در ساعت کاری وجود دارد");
  return result.sort((a, b) => a.day - b.day);
}
function parseCenter(input: Record<string, unknown>) {
  const name = str(input.name, 120).trim(), city = str(input.city, 80).trim(), address = str(input.address, 600).trim();
  const slug = (str(input.slug, 100).trim() || name).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, "");
  if (name.length < 2 || city.length < 2 || address.length < 8 || slug.length < 2) throw new HttpError(400, "نام، شهر، نشانی و شناسه مرکز را کامل کنید");
  const latitude = str(input.latitude, 30).trim(), longitude = str(input.longitude, 30).trim();
  if ((latitude && !/^-?\d+(?:\.\d+)?$/.test(latitude)) || (longitude && !/^-?\d+(?:\.\d+)?$/.test(longitude))) throw new HttpError(400, "مختصات نقشه معتبر نیست");
  const dailyCapacity = int(input.dailyCapacity ?? 30, 1, 10000);
  return { name, slug, city, address, phone: str(input.phone, 30).trim() || null, latitude: latitude || null, longitude: longitude || null, openingHours: openingHours(input.openingHours), dailyCapacity, isActive: input.isActive !== false };
}

export const pickupRoutes: Route[] = [
  { method: "GET", pattern: "pickup-centers", handler: async () => db.select({ id: pickupCenters.id, name: pickupCenters.name, slug: pickupCenters.slug, city: pickupCenters.city, address: pickupCenters.address, phone: pickupCenters.phone, latitude: pickupCenters.latitude, longitude: pickupCenters.longitude, openingHours: pickupCenters.openingHours, dailyCapacity: pickupCenters.dailyCapacity }).from(pickupCenters).where(eq(pickupCenters.isActive, true)).orderBy(pickupCenters.name) },
  { method: "GET", pattern: "admin/pickup-centers", handler: async () => { await requireApi("SHIPMENTS_MANAGE"); return db.select().from(pickupCenters).orderBy(desc(pickupCenters.updatedAt)); } },
  { method: "POST", pattern: "admin/pickup-centers", handler: async (req, _p, meta) => {
    const user = await requireApi("SHIPMENTS_MANAGE"), values = parseCenter(await body(req));
    const [created] = await db.insert(pickupCenters).values(values).returning();
    await audit(db, { userId: user.id, ...meta }, "pickup.center_create", "pickup_center", created.id, null, { name: created.name, city: created.city });
    return created;
  } },
  { method: "POST", pattern: "admin/pickup-centers/:id", handler: async (req, p, meta) => {
    const user = await requireApi("SHIPMENTS_MANAGE"), id = idParam(p.id), values = parseCenter(await body(req));
    const [old] = await db.select().from(pickupCenters).where(eq(pickupCenters.id, id));
    if (!old) throw new HttpError(404, "مرکز دریافت پیدا نشد");
    const [updated] = await db.update(pickupCenters).set({ ...values, updatedAt: new Date() }).where(eq(pickupCenters.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "pickup.center_update", "pickup_center", id, { name: old.name, isActive: old.isActive }, { name: updated.name, isActive: updated.isActive });
    return updated;
  } },
  { method: "GET", pattern: "admin/pickup-orders", handler: async () => {
    await requireApi("SHIPMENTS_MANAGE");
    return db.select({ id: orders.id, number: orders.number, status: orders.status, paymentStatus: orders.paymentStatus, total: orders.total, pickupCenterId: orders.pickupCenterId, pickupCenterName: orders.pickupCenterName, pickupDate: orders.pickupDate, pickupTime: orders.pickupTime, pickupCode: orders.pickupCode, pickupStatus: orders.pickupStatus, pickupReadyAt: orders.pickupReadyAt, pickupCompletedAt: orders.pickupCompletedAt, customerName: users.name, customerPhone: users.phone, createdAt: orders.createdAt }).from(orders).innerJoin(users, eq(users.id, orders.customerId)).where(eq(orders.fulfillmentType, "pickup")).orderBy(desc(orders.createdAt)).limit(100);
  } },
  { method: "POST", pattern: "admin/pickup-orders/:id", handler: async (req, p, meta) => {
    const user = await requireApi("SHIPMENTS_MANAGE"), id = idParam(p.id), next = str((await body(req)).status, 20);
    if (next !== "ready" && next !== "completed") throw new HttpError(400, "وضعیت دریافت معتبر نیست");
    return db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.fulfillmentType, "pickup"))).for("update");
      if (!order) throw new HttpError(404, "سفارش دریافت حضوری پیدا نشد");
      if (order.paymentStatus !== "paid") throw new HttpError(409, "سفارش تا زمان پرداخت، آماده تحویل نمی‌شود");
      if (next === "completed" && order.pickupStatus !== "ready") throw new HttpError(409, "ابتدا سفارش را آماده تحویل کنید");
      if (order.pickupStatus === "completed") throw new HttpError(409, "این سفارش قبلاً تحویل شده است");
      const now = new Date();
      const patch = next === "ready" ? { pickupStatus: "ready", pickupReadyAt: now } : { pickupStatus: "completed", pickupCompletedAt: now, status: "completed" };
      await tx.update(orders).set({ ...patch, updatedAt: now }).where(eq(orders.id, id));
      await tx.insert(orderHistory).values({ orderId: id, status: `pickup_${next}`, note: next === "ready" ? "سفارش برای دریافت حضوری آماده شد" : "سفارش حضوری به مشتری تحویل شد", userId: user.id });
      await audit(tx, { userId: user.id, ...meta }, `pickup.${next}`, "order", id, { pickupStatus: order.pickupStatus }, { pickupStatus: next });
      return { ok: true, status: next };
    });
  } },
];
