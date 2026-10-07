import { and, desc, eq, gte, ilike, isNull, lt, gt, lte, or, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { carrierRates, carriers, discountCodes, festivals, users, variantScheduledDiscounts, productVariants, products } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { editShipmentInfo } from "../services/orders";
import { HttpError, int, slugify, str } from "../util";
import { applicableQuantityTier, quantityTierPrice } from "../quantity-pricing";
import { safeDiscountPercent } from "../marketing";
import { body, idParam, type Route } from "./router";
import { validPhone } from "../commerce-common";

const ids = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/[\s,،]+/)).map((x) => Math.floor(Number(x))).filter((x) => x > 0).slice(0, 500);
function date(v: unknown, endOfDay = false): Date | null {
  const s = str(v, 30);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, "تاریخ نامعتبر");
  return new Date(`${s}T${endOfDay ? "23:59:59" : "00:00:00"}+03:30`);
}
function dateTime(v: unknown): Date {
  const s = str(v, 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) throw new HttpError(400, "تاریخ و ساعت تهران نامعتبر است");
  const result = new Date(`${s}:00+03:30`);
  if (!Number.isFinite(result.getTime())) throw new HttpError(400, "تاریخ و ساعت تهران نامعتبر است");
  const tehranLocal = new Date(result.getTime() + 210 * 60_000).toISOString().slice(0, 16);
  if (tehranLocal !== s) throw new HttpError(400, "تاریخ و ساعت تهران نامعتبر است");
  return result;
}

export const marketingRoutes: Route[] = [
  { method: "GET", pattern: "admin/discounts/customers", handler: async (req) => {
    await requireApi("MARKETING_MANAGE");
    const q = str(req.nextUrl.searchParams.get("q"), 100).trim();
    if (q.length < 2) return [];
    return db.select({ id: users.id, name: users.name, phone: users.phone }).from(users)
      .where(and(eq(users.role, "customer"), eq(users.isActive, true), or(ilike(users.name, `%${q}%`), ilike(users.phone, `%${q}%`))!))
      .orderBy(users.name).limit(30);
  } },
  { method: "GET", pattern: "admin/discounts/products", handler: async (req) => {
    await requireApi("MARKETING_MANAGE");
    const q = str(req.nextUrl.searchParams.get("q"), 100).trim();
    if (q.length < 2) return [];
    return db.select({ id: products.id, name: products.nameFa, sku: products.sku, brand: products.brand, categoryId: products.categoryId })
      .from(products).where(and(eq(products.status, "active"), isNull(products.deletedAt), or(ilike(products.nameFa, `%${q}%`), ilike(products.sku, `%${q}%`), ilike(products.partNumber, `%${q}%`))!))
      .orderBy(products.nameFa).limit(40);
  } },
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

  // ----- scheduled discounts for central inventory variants -----
  { method: "GET", pattern: "admin/variant-discounts/variants", handler: async (req) => {
    await requireApi("MARKETING_MANAGE");
    const q = str(req.nextUrl.searchParams.get("q"), 100).trim();
    if (q.length < 2) return [];
    const rows = await db.select({ variant: productVariants, product: products }).from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(products.source, "central"), eq(products.status, "active"), eq(productVariants.isActive, true), eq(productVariants.isSellable, true), eq(productVariants.inquiryOnly, false), sql`${productVariants.deletedAt} is null`, or(ilike(products.nameFa, `%${q}%`), ilike(products.sku, `%${q}%`), ilike(productVariants.title, `%${q}%`))))
      .orderBy(products.nameFa, productVariants.title).limit(40);
    return rows.map(({ variant, product }) => ({ id: variant.id, productId: product.id, productName: product.nameFa, sku: variant.sku, title: variant.title, price: Number(variant.price ?? product.basePrice), cost: Number(variant.costPrice ?? product.avgCost), quantityPriceTiers: variant.quantityPriceTiers ?? [] }));
  } },
  { method: "GET", pattern: "admin/variant-discounts", handler: async () => {
    await requireApi("MARKETING_MANAGE");
    const rows = await db.select({ discount: variantScheduledDiscounts, variant: productVariants, product: products }).from(variantScheduledDiscounts)
      .innerJoin(productVariants, eq(productVariants.id, variantScheduledDiscounts.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .orderBy(desc(variantScheduledDiscounts.startsAt), desc(variantScheduledDiscounts.id)).limit(200);
    return rows.map(({ discount, variant, product }) => ({ ...discount, productName: product.nameFa, sku: variant.sku, variantTitle: variant.title }));
  } },
  { method: "POST", pattern: "admin/variant-discounts", handler: async (req, _p, meta) => {
    const user = await requireApi("MARKETING_MANAGE"), b = await body(req);
    const variantId = int(b.variantId, 1), title = str(b.title, 120), discountPercent = int(b.discountPercent, 1, 90);
    const startsAt = dateTime(b.startsAt), endsAt = dateTime(b.endsAt);
    if (!title) throw new HttpError(400, "عنوان تخفیف الزامی است");
    if (endsAt <= startsAt) throw new HttpError(400, "پایان تخفیف باید بعد از شروع آن باشد");
    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx.select({ variant: productVariants, product: products }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(eq(productVariants.id, variantId), sql`${productVariants.deletedAt} is null`, eq(productVariants.isActive, true), eq(productVariants.isSellable, true), eq(productVariants.inquiryOnly, false), eq(products.source, "central"), eq(products.status, "active"))).for("update", { of: productVariants });
      if (!row) throw new HttpError(404, "تنوع مرکزیِ فعال و قابل فروش پیدا نشد");
      const price = Number(row.variant.price ?? row.product.basePrice), cost = Number(row.variant.costPrice ?? row.product.avgCost);
      const tiers = row.variant.quantityPriceTiers ?? [];
      const safeMax = Math.min(safeDiscountPercent(price, cost, 90), ...tiers.map((tier) => safeDiscountPercent(quantityTierPrice(price, tier), cost, 90)));
      if (discountPercent > safeMax) throw new HttpError(400, `حداکثر تخفیف امن این تنوع ${safeMax.toLocaleString("fa-IR")}٪ است تا قیمت از بهای خرید و قیمت‌های تعدادی پایین‌تر نرود`);
      const overlaps = await tx.select({ id: variantScheduledDiscounts.id }).from(variantScheduledDiscounts).where(and(
        eq(variantScheduledDiscounts.variantId, variantId), eq(variantScheduledDiscounts.isActive, true),
        lt(variantScheduledDiscounts.startsAt, endsAt), gt(variantScheduledDiscounts.endsAt, startsAt),
      )).limit(1);
      if (overlaps.length) throw new HttpError(409, "برای این تنوع در این بازه تخفیف فعال یا زمان‌بندی‌شده‌ای وجود دارد");
      return tx.insert(variantScheduledDiscounts).values({ variantId, title, discountPercent, startsAt, endsAt, createdBy: user.id }).returning();
    });
    await audit(db, { userId: user.id, ...meta }, "variant_discount.create", "variant_scheduled_discount", created.id, null, created);
    return created;
  } },
  { method: "POST", pattern: "admin/variant-discounts/:id", handler: async (req, p, meta) => {
    const user = await requireApi("MARKETING_MANAGE"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(variantScheduledDiscounts).where(eq(variantScheduledDiscounts.id, id));
    if (!old) throw new HttpError(404, "تخفیف تنوع پیدا نشد");
    if (typeof b.isActive !== "boolean") throw new HttpError(400, "وضعیت فعال‌سازی نامعتبر است");
    await db.update(variantScheduledDiscounts).set({ isActive: b.isActive, updatedAt: new Date() }).where(eq(variantScheduledDiscounts.id, id));
    await audit(db, { userId: user.id, ...meta }, "variant_discount.toggle", "variant_scheduled_discount", id, old, { isActive: b.isActive });
    return { ok: true };
  } },
];

async function parseDiscount(b: Record<string, unknown>) {
  const code = str(b.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3) throw new HttpError(400, "کد تخفیف حداقل ۳ کاراکتر (حروف انگلیسی/عدد)");
  const type = b.type === "fixed" ? "fixed" : "percent";
  const value = int(b.value, 1, type === "percent" ? 100 : 1_000_000_000);
  let customerId: number | null = null, targetPhone: string | null = null;
  if (b.customerId !== undefined && b.customerId !== null && b.customerId !== "") {
    const id = int(b.customerId, 1);
    const [customer] = await db.select({ id: users.id, phone: users.phone }).from(users).where(and(eq(users.id, id), eq(users.role, "customer"), eq(users.isActive, true)));
    if (!customer) throw new HttpError(400, "مشتری انتخاب‌شده فعال نیست یا پیدا نشد");
    customerId = customer.id;
    targetPhone = customer.phone;
  } else if (str(b.customerPhone, 30)) {
    targetPhone = validPhone(b.customerPhone);
    const [customer] = await db.select({ id: users.id }).from(users).where(and(eq(users.phone, targetPhone), eq(users.role, "customer"), eq(users.isActive, true)));
    customerId = customer?.id ?? null;
  }
  const productIds = ids(b.productIds), categoryIds = ids(b.categoryIds);
  if (productIds.length) {
    const active = await db.select({ id: products.id }).from(products).where(and(inArray(products.id, productIds), eq(products.status, "active"), isNull(products.deletedAt)));
    if (active.length !== productIds.length) throw new HttpError(400, "یکی از محصولات انتخاب‌شده فعال نیست یا پیدا نشد");
  }
  const startsAt = date(b.startsAt), endsAt = date(b.endsAt, true);
  if (startsAt && endsAt && endsAt < startsAt) throw new HttpError(400, "تاریخ پایان قبل از شروع است");
  return {
    code, title: str(b.title, 120) || code, type, value, maxDiscount: int(b.maxDiscount ?? 0), minOrder: int(b.minOrder ?? 0), startsAt, endsAt,
    usageLimit: b.usageLimit ? int(b.usageLimit, 1, 10_000_000) : null, perUserLimit: int(b.perUserLimit ?? 1, 0, 1000), customerId, targetPhone,
    productIds, categoryIds, isActive: b.isActive !== false,
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
