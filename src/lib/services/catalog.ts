import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { media, productImages, products, productVariants, sellerOffers, sellers, stockMovements, users, type Compat, type Spec, type ProductOption } from "@/db/schema";
import { audit, notify } from "../audit";
import { postJournal } from "../accounting";
import { sendSms } from "../sms";
import { HttpError, int, normalizePn, slugify, str } from "../util";
import { sanitizeRich } from "../html";
import type { OrganicInfo } from "@/db/schema";

const ORGANIC_KEYS = ["origin", "region", "harvest", "method", "certificate", "labTest", "storage", "shelfLife", "ingredients"] as const;
export function parseOrganic(v: unknown): OrganicInfo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: OrganicInfo = {};
  for (const k of ORGANIC_KEYS) { const x = str(o[k], 300); if (x) out[k] = x; }
  const tags = Array.isArray(o.suitableFor) ? o.suitableFor : String(o.suitableFor ?? "").split(/[,،]/);
  out.suitableFor = Array.from(new Set(tags.map((t) => str(t, 40)).filter(Boolean))).slice(0, 12);
  return out;
}
import type { SessionUser } from "../auth";
import type { Ctx } from "../types";

const AUTH = ["Original", "OEM", "Aftermarket"];
const IMPORTANT = ["nameFa", "partNumber", "oemNumber", "brand", "authenticity", "categoryId", "specs", "organicInfo"] as const;

export function parseProductInput(b: Record<string, unknown>) {
  const nameFa = str(b.nameFa, 200);
  const partNumber = str(b.partNumber, 80);
  const sku = str(b.sku, 60);
  const brand = str(b.brand, 80);
  if (!nameFa || !partNumber || !sku || !brand) throw new HttpError(400, "نام فارسی، SKU، کد محصول و برند الزامی هستند");
  const authenticity = AUTH.includes(String(b.authenticity)) ? String(b.authenticity) : "Aftermarket";
  const specs: Spec[] = Array.isArray(b.specs) ? (b.specs as Spec[]).map((s) => ({ k: str(s.k, 80), v: str(s.v, 200) })).filter((s) => s.k).slice(0, 40) : [];
  const compatibility: Compat[] = Array.isArray(b.compatibility) ? (b.compatibility as Compat[]).map((c) => ({ make: str(c.make, 60), model: str(c.model, 60), years: str(c.years, 40) })).filter((c) => c.make).slice(0, 40) : [];
  const crossRefs = Array.isArray(b.crossRefs) ? (b.crossRefs as unknown[]).map((x) => str(x, 60)).filter(Boolean).slice(0, 30) : str(b.crossRefs, 1000).split(/[,\n،]/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const imageIds = Array.isArray(b.imageIds) ? (b.imageIds as unknown[]).map((x) => int(x, 1)).slice(0, 12) : [];
  const options: ProductOption[] = Array.isArray(b.options) ? (b.options as Record<string, unknown>[]).map((o) => ({
    name: str(o.name, 40), values: Array.from(new Set((Array.isArray(o.values) ? o.values : String(o.values ?? "").split(/[,،]/)).map((x) => str(x, 40)).filter(Boolean))).slice(0, 20),
  })).filter((o) => o.name && o.values.length).slice(0, 3) : [];
  if (new Set(options.map((o) => o.name)).size !== options.length) throw new HttpError(400, "نام پارامترهای تنوع تکراری است");
  const variants = Array.isArray(b.variants) ? (b.variants as Record<string, unknown>[]).map((v) => {
    const rawAttrs = (v.attrs && typeof v.attrs === "object" ? v.attrs : {}) as Record<string, unknown>;
    const attrs: Record<string, string> = {};
    for (const o of options) {
      const val = str(rawAttrs[o.name], 40);
      if (!o.values.includes(val)) throw new HttpError(400, `مقدار «${o.name}» در یکی از تنوع‌ها نامعتبر است`);
      attrs[o.name] = val;
    }
    const title = options.length ? options.map((o) => attrs[o.name]).join(" / ") : str(v.title, 80);
    return { id: v.id ? int(v.id, 1) : undefined, title, attrs, sku: str(v.sku, 60), price: int(v.price ?? 0), onHand: int(v.onHand ?? 0, 0, 100000), isActive: v.isActive !== false };
  }).filter((v) => v.title).slice(0, 60) : [];
  const combos = new Set(variants.map((v) => JSON.stringify(v.attrs)));
  if (options.length && combos.size !== variants.length) throw new HttpError(400, "ترکیب تکراری در تنوع‌ها وجود دارد");
  return {
    data: {
      nameFa, nameEn: str(b.nameEn, 200) || null, sku, partNumber, normalizedPn: normalizePn(partNumber), oemNumber: str(b.oemNumber, 80) || null,
      crossRefs, brand, manufacturer: str(b.manufacturer, 80) || null, country: str(b.country, 60) || null,
      categoryId: b.categoryId ? int(b.categoryId, 1) : null, authenticity,
      basePrice: int(b.basePrice ?? 0), compareAtPrice: int(b.compareAtPrice ?? 0),
      shortDesc: str(b.shortDesc, 500) || null, description: sanitizeRich(str(b.description, 100000)) || null, technicalReview: sanitizeRich(str(b.technicalReview, 100000)) || null,
      specs, compatibility, weight: b.weight ? int(b.weight, 0, 1000000) : null, barcode: str(b.barcode, 40) || null,
      seoTitle: str(b.seoTitle, 120) || null, metaDesc: str(b.metaDesc, 300) || null,
      slug: slugify(str(b.slug, 120) || `${str(b.nameEn, 120) || nameFa}-${sku}`),
      lowStockThreshold: b.lowStockThreshold !== undefined ? int(b.lowStockThreshold, 0, 10000) : 3,
      options,
      organicInfo: parseOrganic(b.organicInfo),
      videoMediaId: b.videoMediaId ? int(b.videoMediaId, 1) : null,
    },
    imageIds, variants,
    offer: b.offerPrice ? { price: int(b.offerPrice, 1), costPrice: b.offerCostPrice ? int(b.offerCostPrice, 1) : int(b.offerPrice, 1), stock: int(b.offerStock ?? 0, 0, 100000), shippingCost: int(b.offerShipping ?? 0), prepDays: int(b.offerPrepDays ?? 1, 0, 60), warranty: str(b.offerWarranty, 200) || null } : null,
  };
}

export async function saveProduct(ctx: Ctx & { userId: number }, u: SessionUser, body: Record<string, unknown>, id?: number) {
  const input = parseProductInput(body);
  const isSeller = !!u.sellerId && !u.staff;
  if (isSeller && u.sellerStatus !== "approved") throw new HttpError(403, "حساب تأمین‌کننده هنوز تأیید نشده است");
  if (!isSeller && !u.permissions.includes(id ? "PRODUCTS_EDIT" : "PRODUCTS_CREATE")) throw new HttpError(403, "دسترسی غیرمجاز");
  return db.transaction(async (tx) => {
    const dupSku = await tx.select({ id: products.id }).from(products).where(and(eq(products.sku, input.data.sku), id ? ne(products.id, id) : undefined));
    if (dupSku.length) throw new HttpError(409, "SKU تکراری است");
    const dupSlug = await tx.select({ id: products.id }).from(products).where(and(eq(products.slug, input.data.slug), id ? ne(products.id, id) : undefined));
    if (dupSlug.length) input.data.slug = `${input.data.slug}-${Date.now().toString(36)}`;
    if (input.data.videoMediaId) {
      const [vm] = await tx.select({ id: media.id, by: media.uploadedBy, mime: media.mime }).from(media).where(eq(media.id, input.data.videoMediaId));
      if (!vm || !vm.mime.startsWith("video/")) throw new HttpError(400, "ویدیو نامعتبر");
      if (isSeller && vm.by !== u.id) throw new HttpError(403, "فقط ویدیوی آپلودشده توسط خودتان مجاز است");
      await tx.update(media).set({ isPublic: true }).where(eq(media.id, vm.id));
    }
    if (input.imageIds.length) {
      await tx.update(media).set({ isPublic: true }).where(inArray(media.id, input.imageIds));
      const ms = await tx.select({ id: media.id, uploadedBy: media.uploadedBy }).from(media).where(inArray(media.id, input.imageIds));
      if (ms.length !== new Set(input.imageIds).size) throw new HttpError(400, "تصویر نامعتبر");
      if (isSeller && ms.some((m) => m.uploadedBy !== u.id)) throw new HttpError(403, "فقط تصاویر آپلودشده توسط خودتان مجاز است");
    }
    let productId: number;
    let old: typeof products.$inferSelect | undefined;
    if (id) {
      [old] = await tx.select().from(products).where(eq(products.id, id)).for("update");
      if (!old || old.status === "deleted") throw new HttpError(404, "محصول یافت نشد");
      if (isSeller && old.ownerSellerId !== u.sellerId) throw new HttpError(404, "محصول یافت نشد");
      const importantChanged = IMPORTANT.some((k) => JSON.stringify(old![k]) !== JSON.stringify(input.data[k]));
      const status = isSeller && importantChanged && old.status !== "draft" ? "pending" : old.status;
      await tx.update(products).set({ ...input.data, status, mainImageId: input.imageIds[0] ?? null, updatedAt: new Date() }).where(eq(products.id, id));
      productId = id;
      await audit(tx, ctx, old.basePrice !== input.data.basePrice ? "product.price_change" : "product.update", "product", id,
        { basePrice: old.basePrice, status: old.status, nameFa: old.nameFa }, { basePrice: input.data.basePrice, status, nameFa: input.data.nameFa });
    } else {
      const [p] = await tx.insert(products).values({
        ...input.data, status: isSeller ? "pending" : (body.status === "active" ? "active" : "draft"),
        source: isSeller ? "marketplace" : "central", ownerSellerId: isSeller ? u.sellerId : null, createdBy: u.id, mainImageId: input.imageIds[0] ?? null,
      }).returning();
      productId = p.id;
      await audit(tx, ctx, "product.create", "product", p.id, null, { sku: p.sku, status: p.status });
    }
    await tx.delete(productImages).where(eq(productImages.productId, productId));
    if (input.imageIds.length) await tx.insert(productImages).values(input.imageIds.map((m, i) => ({ productId, mediaId: m, sortOrder: i })));
    if (!isSeller) {
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, productId));
      const keep = new Set<number>();
      for (const v of input.variants) {
        if (v.id && existing.some((e) => e.id === v.id)) {
          keep.add(v.id);
          await tx.update(productVariants).set({ title: v.title, attrs: v.attrs, sku: v.sku, price: v.price, isActive: v.isActive }).where(eq(productVariants.id, v.id));
        } else {
          const [nv] = await tx.insert(productVariants).values({ productId, title: v.title, attrs: v.attrs, sku: v.sku || `${input.data.sku}-${existing.length + keep.size + 1}`, price: v.price, onHand: v.onHand, isActive: v.isActive }).returning();
          if (v.onHand > 0) await tx.insert(stockMovements).values({ productId, variantId: nv.id, type: "initial", qty: v.onHand, userId: ctx.userId, note: "موجودی اولیه تنوع" });
        }
      }
      for (const e of existing) if (!keep.has(e.id) && e.reserved === 0) await tx.update(productVariants).set({ isActive: false }).where(eq(productVariants.id, e.id));
    }
    if (isSeller && input.offer && u.sellerId) {
      const [ex] = await tx.select().from(sellerOffers).where(and(eq(sellerOffers.productId, productId), eq(sellerOffers.sellerId, u.sellerId)));
      if (!ex) {
        const [sel] = await tx.select().from(sellers).where(eq(sellers.id, u.sellerId));
        await tx.insert(sellerOffers).values({ productId, sellerId: u.sellerId, ...input.offer, shipCity: sel?.city, status: "pending" });
      }
    }
    return { id: productId };
  });
}

export async function setProductStatus(ctx: Ctx & { userId: number }, u: SessionUser, id: number, status: string, reason?: string) {
  const perm = ["active", "approved", "rejected"].includes(status) ? "PRODUCTS_APPROVE" : "PRODUCTS_DISABLE";
  const isOwnerSeller = !!u.sellerId && !u.staff;
  let sms: { phone: string; event: string; name: string } | null = null;
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!p) throw new HttpError(404, "محصول یافت نشد");
    if (isOwnerSeller) {
      if (p.ownerSellerId !== u.sellerId) throw new HttpError(404, "محصول یافت نشد");
      if (!(status === "pending" && ["draft", "rejected"].includes(p.status)) && !(status === "deleted" && p.status !== "active")) throw new HttpError(403, "این تغییر وضعیت برای فروشنده مجاز نیست");
    } else if (!u.permissions.includes(perm)) throw new HttpError(403, "دسترسی غیرمجاز");
    if (status === "deleted" && p.reserved > 0) throw new HttpError(400, "محصول دارای موجودی رزروشده است");
    await tx.update(products).set({ status, rejectReason: status === "rejected" ? reason ?? null : null, updatedAt: new Date() }).where(eq(products.id, id));
    await audit(tx, ctx, status === "active" || status === "approved" ? "product.approve" : `product.${status}`, "product", id, { status: p.status }, { status, reason });
    if (p.ownerSellerId && ["active", "rejected", "suspended"].includes(status)) {
      const [row] = await tx.select({ s: sellers, u: users }).from(sellers).innerJoin(users, eq(users.id, sellers.userId)).where(eq(sellers.id, p.ownerSellerId));
      if (row) {
        await notify(tx, row.u.id, `وضعیت محصول ${p.nameFa}: ${status}`, reason, "/seller/products");
        if (status !== "suspended") sms = { phone: row.u.phone, event: status === "active" ? "product_approved" : "product_rejected", name: p.nameFa };
        if (status === "active") await tx.update(sellerOffers).set({ status: "approved" }).where(and(eq(sellerOffers.productId, id), eq(sellerOffers.sellerId, p.ownerSellerId), eq(sellerOffers.status, "pending")));
      }
    }
  });
  const s = sms as { phone: string; event: string; name: string } | null;
  if (s) void sendSms(s.event, s.phone, { product: s.name });
}

export async function upsertOffer(ctx: Ctx & { userId: number }, sellerId: number, b: Record<string, unknown>) {
  const productId = int(b.productId, 1);
  const data = {
    price: int(b.price, 1000), costPrice: b.costPrice ? int(b.costPrice, 1) : int(b.price, 1000), salePrice: b.salePrice ? int(b.salePrice, 1000) : null, stock: int(b.stock ?? 0, 0, 100000),
    shippingCost: int(b.shippingCost ?? 0, 0, 10_000_000), prepDays: int(b.prepDays ?? 1, 0, 60), shipCity: str(b.shipCity, 60) || null,
    warranty: str(b.warranty, 200) || null, condition: ["new", "used", "refurbished"].includes(String(b.condition)) ? String(b.condition) : "new",
  };
  if (data.salePrice && data.salePrice > data.price) throw new HttpError(400, "قیمت تخفیفی نباید بیشتر از قیمت فروش باشد");
  if (data.costPrice > (data.salePrice ?? data.price)) throw new HttpError(400, "قیمت فروش نباید از قیمت خرید کمتر باشد");
  return db.transaction(async (tx) => {
    const [sel] = await tx.select().from(sellers).where(eq(sellers.id, sellerId));
    if (!sel || sel.status !== "approved") throw new HttpError(403, "تأمین‌کننده تأیید نشده است");
    const [p] = await tx.select().from(products).where(eq(products.id, productId));
    if (!p || ["deleted", "rejected", "suspended"].includes(p.status)) throw new HttpError(404, "محصول یافت نشد");
    const [ex] = await tx.select().from(sellerOffers).where(and(eq(sellerOffers.productId, productId), eq(sellerOffers.sellerId, sellerId))).for("update");
    if (ex) {
      if (data.stock < ex.reserved) throw new HttpError(400, `موجودی نمی‌تواند کمتر از رزرو (${ex.reserved}) باشد`);
      const sensitive = Math.abs(data.price - ex.price) / ex.price > 0.2 || data.condition !== ex.condition;
      const status = sensitive && ex.status === "approved" ? "pending" : ex.status;
      const [o] = await tx.update(sellerOffers).set({ ...data, status, updatedAt: new Date() }).where(eq(sellerOffers.id, ex.id)).returning();
      if (ex.stock !== data.stock) await tx.insert(stockMovements).values({ productId, offerId: ex.id, type: "seller_adjust", qty: data.stock - ex.stock, userId: ctx.userId });
      await audit(tx, ctx, ex.price !== data.price ? "offer.price_change" : "offer.update", "seller_offer", ex.id, { price: ex.price, stock: ex.stock, status: ex.status }, { price: data.price, stock: data.stock, status });
      return o;
    }
    const [o] = await tx.insert(sellerOffers).values({ ...data, productId, sellerId, status: "pending" }).returning();
    await audit(tx, ctx, "offer.create", "seller_offer", o.id, null, data);
    return o;
  });
}

export async function setOfferStatus(ctx: Ctx & { userId: number }, id: number, status: string, scope: { sellerId?: number; staff: boolean }) {
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(sellerOffers).where(eq(sellerOffers.id, id)).for("update");
    if (!o) throw new HttpError(404, "پیشنهاد یافت نشد");
    if (!scope.staff) {
      if (o.sellerId !== scope.sellerId) throw new HttpError(404, "پیشنهاد یافت نشد");
      const ok = (o.status === "approved" && status === "inactive") || (o.status === "inactive" && status === "approved");
      if (!ok) throw new HttpError(403, "فروشنده فقط می‌تواند پیشنهاد تأییدشده را فعال/غیرفعال کند");
    } else if (!["approved", "rejected", "inactive", "suspended"].includes(status)) throw new HttpError(400, "وضعیت نامعتبر");
    if (status === "approved" && scope.staff) {
      const [p] = await tx.select().from(products).where(eq(products.id, o.productId));
      if (p.status !== "active") throw new HttpError(400, "محصول هنوز فعال نیست؛ ابتدا محصول را تأیید کنید");
    }
    await tx.update(sellerOffers).set({ status, updatedAt: new Date() }).where(eq(sellerOffers.id, id));
    await audit(tx, ctx, `offer.${status}`, "seller_offer", id, { status: o.status }, { status });
  });
}

export async function setBuyBox(ctx: Ctx & { userId: number }, offerId: number) {
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(sellerOffers).where(eq(sellerOffers.id, offerId));
    if (!o || o.status !== "approved") throw new HttpError(400, "فقط پیشنهاد تأییدشده");
    await tx.update(sellerOffers).set({ isBuyBox: false }).where(eq(sellerOffers.productId, o.productId));
    await tx.update(sellerOffers).set({ isBuyBox: true }).where(eq(sellerOffers.id, offerId));
    await audit(tx, ctx, "offer.buybox", "seller_offer", offerId, null, { productId: o.productId });
  });
}

/** Central warehouse purchase receipt with weighted average cost. */
export async function receiveStock(ctx: Ctx & { userId: number }, productId: number, qty: number, unitCost: number, freight: number, customs: number, note: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!p) throw new HttpError(404, "محصول یافت نشد");
    if (qty === 0) throw new HttpError(400, "تعداد نامعتبر");
    const variants = await tx.select().from(productVariants).where(eq(productVariants.productId, productId)).for("update");
    const stockVariant = variants.find((variant) => variant.title === "پیش‌فرض") ?? (variants.length === 1 ? variants[0] : null);
    if (qty > 0) {
      const landed = unitCost * qty + freight + customs;
      const newAvg = Math.round((p.onHand * p.avgCost + landed) / (p.onHand + qty));
      await tx.update(products).set({ onHand: p.onHand + qty, avgCost: newAvg, status: p.status === "out_of_stock" ? "active" : p.status }).where(eq(products.id, productId));
      if (stockVariant) await tx.update(productVariants).set({ onHand: stockVariant.onHand + qty, isActive: true }).where(eq(productVariants.id, stockVariant.id));
      else await tx.insert(productVariants).values({ productId, title: "پیش‌فرض", attrs: {}, sku: `${p.sku}-DEFAULT-${p.id}`, price: p.basePrice, onHand: variants.length ? qty : p.onHand + qty, reserved: variants.length ? 0 : p.reserved, isActive: true });
      await tx.insert(stockMovements).values({ productId, type: "purchase_in", qty, unitCost: Math.round(landed / qty), refType: "purchase", note, userId: ctx.userId });
      await postJournal(tx, `خرید و ورود کالا ${p.sku}`, [
        { code: "1201", debit: landed }, { code: "2104", credit: unitCost * qty }, { code: "1101", credit: freight + customs, description: "حمل و گمرک" },
      ], { type: "product", id: productId }, ctx.userId);
      await audit(tx, ctx, "inventory.receive", "product", productId, { onHand: p.onHand, avgCost: p.avgCost }, { onHand: p.onHand + qty, avgCost: newAvg });
    } else {
      const out = -qty;
      if (p.onHand - p.reserved < out) throw new HttpError(400, "موجودی آزاد کافی نیست");
      if (stockVariant && stockVariant.onHand - stockVariant.reserved < out) throw new HttpError(400, "موجودی آزاد تنوع پیش‌فرض برای ثبت کسری کافی نیست");
      await tx.update(products).set({ onHand: p.onHand - out }).where(eq(products.id, productId));
      if (stockVariant) await tx.update(productVariants).set({ onHand: stockVariant.onHand - out }).where(eq(productVariants.id, stockVariant.id));
      await tx.insert(stockMovements).values({ productId, type: "adjust_out", qty, unitCost: p.avgCost, note, userId: ctx.userId });
      await postJournal(tx, `کسری/ضایعات انبار ${p.sku}`, [{ code: "5101", debit: p.avgCost * out }, { code: "1201", credit: p.avgCost * out }], { type: "product", id: productId }, ctx.userId);
      await audit(tx, ctx, "inventory.adjust", "product", productId, { onHand: p.onHand }, { onHand: p.onHand - out, note });
    }
  });
}
