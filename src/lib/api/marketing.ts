import { eq } from "drizzle-orm";
import { db } from "@/db";
import { carrierRates, carriers, discountCodes, festivals, users } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { editShipmentInfo } from "../services/orders";
import { HttpError, int, slugify, str } from "../util";
import { body, idParam, type Route } from "./router";

const ids = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/[\s,،]+/)).map((x) => Math.floor(Number(x))).filter((x) => x > 0).slice(0, 500);
function date(v: unknown, endOfDay = false): Date | null {
  const s = str(v, 30);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, "تاریخ نامعتبر");
  return new Date(`${s}T${endOfDay ? "23:59:59" : "00:00:00"}+03:30`);
}

export const marketingRoutes: Route[] = [
  // ----- carriers -----
  { method: "POST", pattern: "admin/carriers", handler: async (req, _p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const b = await body(req);
    const data = {
      name: str(b.name, 80), code: str(b.code, 30).toLowerCase().replace(/[^a-z0-9_-]/g, "") || `c${Date.now().toString(36)}`,
      trackingUrl: str(b.trackingUrl, 300) || null, baseCost: int(b.baseCost ?? 0), perKgCost: int(b.perKgCost ?? 0), freeThreshold: int(b.freeThreshold ?? 0),
      supportsFreightCollect: b.supportsFreightCollect === true,
      minDays: int(b.minDays ?? 1, 0, 60), maxDays: int(b.maxDays ?? 3, 0, 90), sortOrder: int(b.sortOrder ?? 0, 0, 1000), isActive: b.isActive !== false,
    };
    if (!data.name) throw new HttpError(400, "نام شرکت پستی الزامی است");
    if (data.trackingUrl && !/^https:\/\//.test(data.trackingUrl)) throw new HttpError(400, "آدرس رهگیری باید با https شروع شود");
    const [c] = await db.insert(carriers).values(data).returning();
    await audit(db, { userId: u.id, ...m }, "carrier.create", "carrier", c.id, null, data);
    return c;
  } },
  { method: "POST", pattern: "admin/carriers/:id", handler: async (req, p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(carriers).where(eq(carriers.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    const trackingUrl = b.trackingUrl !== undefined ? str(b.trackingUrl, 300) || null : old.trackingUrl;
    if (trackingUrl && !/^https:\/\//.test(trackingUrl)) throw new HttpError(400, "آدرس رهگیری باید با https شروع شود");
    const patch = {
      name: str(b.name, 80) || old.name, trackingUrl,
      baseCost: b.baseCost !== undefined ? int(b.baseCost) : old.baseCost, perKgCost: b.perKgCost !== undefined ? int(b.perKgCost) : old.perKgCost,
      freeThreshold: b.freeThreshold !== undefined ? int(b.freeThreshold) : old.freeThreshold, minDays: b.minDays !== undefined ? int(b.minDays, 0, 60) : old.minDays,
      supportsFreightCollect: b.supportsFreightCollect !== undefined ? b.supportsFreightCollect === true : old.supportsFreightCollect,
      maxDays: b.maxDays !== undefined ? int(b.maxDays, 0, 90) : old.maxDays, sortOrder: b.sortOrder !== undefined ? int(b.sortOrder, 0, 1000) : old.sortOrder,
      isActive: b.isActive !== undefined ? b.isActive === true : old.isActive,
    };
    await db.update(carriers).set(patch).where(eq(carriers.id, id));
    await audit(db, { userId: u.id, ...m }, "carrier.update", "carrier", id, old, patch);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/carriers/:id/rates", handler: async (req, p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const carrierId = idParam(p.id);
    const b = await body(req);
    const minWeight = int(b.minWeight ?? 0, 0, 1_000_000), maxWeight = int(b.maxWeight ?? 1_000_000, 0, 1_000_000);
    if (maxWeight < minWeight) throw new HttpError(400, "حداکثر وزن باید بیشتر از حداقل باشد");
    const [r] = await db.insert(carrierRates).values({ carrierId, city: str(b.city, 60) || null, minWeight, maxWeight, cost: int(b.cost ?? 0) }).returning();
    await audit(db, { userId: u.id, ...m }, "carrier.rate_create", "carrier", carrierId, null, r);
    return r;
  } },
  { method: "POST", pattern: "admin/carrier-rates/:id/delete", handler: async (_r, p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const id = idParam(p.id);
    const [r] = await db.select().from(carrierRates).where(eq(carrierRates.id, id));
    if (!r) throw new HttpError(404, "یافت نشد");
    await db.delete(carrierRates).where(eq(carrierRates.id, id));
    await audit(db, { userId: u.id, ...m }, "carrier.rate_delete", "carrier", r.carrierId, r, null);
    return { ok: true };
  } },

  // ----- shipment info -----
  { method: "POST", pattern: "admin/shipments/:id/info", handler: async (req, p, m) => {
    const u = await requireApi("SHIPMENTS_MANAGE");
    const b = await body(req);
    return editShipmentInfo({ userId: u.id, ...m }, idParam(p.id), { carrierId: b.carrierId ? int(b.carrierId, 1) : null, trackingNumber: b.trackingNumber !== undefined ? str(b.trackingNumber, 60) : undefined, shippedAt: date(b.shippedAt) ?? undefined, notes: b.notes !== undefined ? str(b.notes, 500) : undefined }, { sellerId: null, staff: true });
  } },
  { method: "POST", pattern: "seller/shipments/:id/info", handler: async (req, p, m) => {
    const u = await requireApi();
    if (!u.sellerId) throw new HttpError(403, "فقط تأمین‌کنندگان");
    const b = await body(req);
    return editShipmentInfo({ userId: u.id, ...m }, idParam(p.id), { carrierId: b.carrierId ? int(b.carrierId, 1) : null, trackingNumber: b.trackingNumber !== undefined ? str(b.trackingNumber, 60) : undefined, shippedAt: date(b.shippedAt) ?? undefined, notes: b.notes !== undefined ? str(b.notes, 500) : undefined }, { sellerId: u.sellerId, staff: false });
  } },

  // ----- discount codes -----
  { method: "POST", pattern: "admin/discounts", handler: async (req, _p, m) => {
    const u = await requireApi("MARKETING_MANAGE");
    const b = await body(req);
    const data = await parseDiscount(b);
    const [d] = await db.insert(discountCodes).values(data).returning();
    await audit(db, { userId: u.id, ...m }, "discount.create", "discount_code", d.id, null, data);
    return d;
  } },
  { method: "POST", pattern: "admin/discounts/:id", handler: async (req, p, m) => {
    const u = await requireApi("MARKETING_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    if (Object.keys(b).length === 1 && "isActive" in b) {
      await db.update(discountCodes).set({ isActive: b.isActive === true }).where(eq(discountCodes.id, id));
    } else {
      const data = await parseDiscount(b);
      await db.update(discountCodes).set({ ...data, code: old.usedCount > 0 ? old.code : data.code }).where(eq(discountCodes.id, id));
    }
    await audit(db, { userId: u.id, ...m }, "discount.update", "discount_code", id, old, b);
    return { ok: true };
  } },

  // ----- festivals -----
  { method: "POST", pattern: "admin/festivals", handler: async (req, _p, m) => {
    const u = await requireApi("MARKETING_MANAGE");
    const data = parseFestival(await body(req));
    const [f] = await db.insert(festivals).values(data).returning();
    await audit(db, { userId: u.id, ...m }, "festival.create", "festival", f.id, null, data);
    return f;
  } },
  { method: "POST", pattern: "admin/festivals/:id", handler: async (req, p, m) => {
    const u = await requireApi("MARKETING_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(festivals).where(eq(festivals.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    if (Object.keys(b).length === 1 && "isActive" in b) await db.update(festivals).set({ isActive: b.isActive === true }).where(eq(festivals.id, id));
    else await db.update(festivals).set({ ...parseFestival(b), slug: old.slug }).where(eq(festivals.id, id));
    await audit(db, { userId: u.id, ...m }, "festival.update", "festival", id, old, b);
    return { ok: true };
  } },
];

async function parseDiscount(b: Record<string, unknown>) {
  const code = str(b.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3) throw new HttpError(400, "کد تخفیف حداقل ۳ کاراکتر (حروف انگلیسی/عدد)");
  const type = b.type === "fixed" ? "fixed" : "percent";
  const value = int(b.value, 1, type === "percent" ? 100 : 1_000_000_000);
  let customerId: number | null = null;
  const phone = str(b.customerPhone, 20);
  if (phone) {
    const [c] = await db.select().from(users).where(eq(users.phone, phone));
    if (!c) throw new HttpError(400, "مشتری با این شماره یافت نشد");
    customerId = c.id;
  }
  const startsAt = date(b.startsAt), endsAt = date(b.endsAt, true);
  if (startsAt && endsAt && endsAt < startsAt) throw new HttpError(400, "تاریخ پایان قبل از شروع است");
  return {
    code, title: str(b.title, 120) || code, type, value, maxDiscount: int(b.maxDiscount ?? 0), minOrder: int(b.minOrder ?? 0), startsAt, endsAt,
    usageLimit: b.usageLimit ? int(b.usageLimit, 1, 10_000_000) : null, perUserLimit: int(b.perUserLimit ?? 1, 0, 1000), customerId,
    productIds: ids(b.productIds), categoryIds: ids(b.categoryIds), isActive: b.isActive !== false,
  };
}

function parseFestival(b: Record<string, unknown>) {
  const title = str(b.title, 120);
  if (!title) throw new HttpError(400, "عنوان جشنواره الزامی است");
  const startsAt = date(b.startsAt), endsAt = date(b.endsAt, true);
  if (!startsAt || !endsAt || endsAt < startsAt) throw new HttpError(400, "بازه زمانی جشنواره نامعتبر است");
  const color = /^#[0-9a-fA-F]{6}$/.test(str(b.color, 7)) ? str(b.color, 7) : "#e11d48";
  return {
    title, slug: `${slugify(title)}-${Date.now().toString(36)}`, description: str(b.description, 500) || null, color, discountPercent: int(b.discountPercent, 1, 90),
    startsAt, endsAt, productIds: ids(b.productIds), categoryIds: ids(b.categoryIds), isActive: b.isActive !== false,
  };
}
