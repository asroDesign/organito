import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, inventoryConsignmentLots, inventoryParties, inventoryReceipts, inventoryRepackJobs, inventorySupplierPayments, media, productImages, products, productVariants, sellerOffers, sellers, stockMovements, users, type Compat, type Spec, type ProductOption, type PurchaseOption, type ProductFaq } from "@/db/schema";
import { audit, notify } from "../audit";
import { postJournal } from "../accounting";
import { sendSms } from "../sms";
import { HttpError, genNumber, int, normalizePn, slugify, str } from "../util";
import { ensureInventoryPartyDetail, consumeConsignmentLots, postConsignmentPayables, transferConsignmentLots } from "./inventory-accounting";
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
  const specs: Spec[] = Array.isArray(b.specs) ? (b.specs as Record<string, unknown>[]).map((s, i) => ({ k: str(s.k, 80), v: str(s.v, 200), group: str(s.group, 80) || undefined, hidden: s.hidden === true, order: Number.isFinite(Number(s.order)) ? int(s.order, 0, 999) : i })).filter((s) => s.k).slice(0, 80) : [];
  const compatibility: Compat[] = Array.isArray(b.compatibility) ? (b.compatibility as Compat[]).map((c) => ({ make: str(c.make, 60), model: str(c.model, 60), years: str(c.years, 40) })).filter((c) => c.make).slice(0, 40) : [];
  const crossRefs = Array.isArray(b.crossRefs) ? (b.crossRefs as unknown[]).map((x) => str(x, 60)).filter(Boolean).slice(0, 30) : str(b.crossRefs, 1000).split(/[,\n،]/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const imageIds = Array.isArray(b.imageIds) ? (b.imageIds as unknown[]).map((x) => int(x, 1)).slice(0, 12) : [];
  const options: ProductOption[] = Array.isArray(b.options) ? (b.options as Record<string, unknown>[]).map((o) => ({
    name: str(o.name, 40), values: Array.from(new Set((Array.isArray(o.values) ? o.values : String(o.values ?? "").split(/[,،]/)).map((x) => str(x, 40)).filter(Boolean))).slice(0, 20),
  })).filter((o) => o.name && o.values.length).slice(0, 3) : [];
  if (new Set(options.map((o) => o.name)).size !== options.length) throw new HttpError(400, "نام پارامترهای تنوع تکراری است");
  const purchaseOptions: PurchaseOption[] = Array.isArray(b.purchaseOptions) ? (b.purchaseOptions as Record<string, unknown>[]).map((o) => ({
    name: str(o.name, 80), type: (["text", "select", "checkbox", "radio"].includes(String(o.type)) ? String(o.type) : "select") as PurchaseOption["type"], required: o.required === true,
    values: (Array.isArray(o.values) ? o.values as Record<string, unknown>[] : []).map((v) => ({ label: str(v.label, 80), price: int(v.price ?? 0, 0, 1000000000), priceType: v.priceType === "percent" ? "percent" as const : "fixed" as const })).filter((v) => v.label).slice(0, 30),
  })).filter((o) => o.name).slice(0, 20) : [];
  if (new Set(purchaseOptions.map((o) => o.name)).size !== purchaseOptions.length) throw new HttpError(400, "نام گزینه‌های محصول تکراری است");
  for (const option of purchaseOptions) if (new Set(option.values.map((v) => v.label)).size !== option.values.length) throw new HttpError(400, `انتخاب تکراری در گزینه «${option.name}» وجود دارد`);
  const productFaqs: ProductFaq[] = Array.isArray(b.productFaqs) ? (b.productFaqs as Record<string, unknown>[]).map((x) => ({ question: str(x.question, 1000), answer: str(x.answer, 3000) })).filter((x) => x.question && x.answer).slice(0, 40) : [];
  const cleanIds = (v: unknown) => Array.isArray(v) ? Array.from(new Set(v.map((x) => int(x, 1)).filter(Boolean))).slice(0, 30) : [];
  const relatedProductIds = cleanIds(b.relatedProductIds), crossSellProductIds = cleanIds(b.crossSellProductIds);
  const seoKeywords = Array.isArray(b.seoKeywords) ? Array.from(new Set(b.seoKeywords.map((x) => str(x, 60)).filter(Boolean))).slice(0, 30) : str(b.seoKeywords, 1200).split(/[,،\n]/).map((x) => str(x, 60)).filter(Boolean).slice(0, 30);
  const deliveryMinDays = int(b.deliveryMinDays ?? 2, 0, 365), deliveryMaxDays = int(b.deliveryMaxDays ?? 5, 0, 365);
  if (deliveryMaxDays < deliveryMinDays) throw new HttpError(400, "حداکثر زمان تحویل نمی‌تواند کمتر از حداقل باشد");
  const deletedVariantIds = new Set<number>();
  const variants = Array.isArray(b.variants) ? (b.variants as Record<string, unknown>[]).flatMap((v) => {
    const id = v.id ? int(v.id, 1) : undefined;
    const rawAttrs = (v.attrs && typeof v.attrs === "object" ? v.attrs : {}) as Record<string, unknown>;
    const attrs: Record<string, string> = {};
    const hasStaleAttributes = id && (options.length === 0 ? Object.keys(rawAttrs).length > 0 : Object.keys(rawAttrs).some((key) => !options.some((option) => option.name === key)));
    if (hasStaleAttributes) { deletedVariantIds.add(id); return []; }
    let invalidOptionValue = false;
    for (const o of options) {
      const val = str(rawAttrs[o.name], 40);
      if (!o.values.includes(val)) { invalidOptionValue = true; break; }
      attrs[o.name] = val;
    }
    if (invalidOptionValue) {
      if (id) { deletedVariantIds.add(id); return []; }
      throw new HttpError(400, "مقدار انتخاب‌شده برای یکی از تنوع‌های جدید معتبر نیست");
    }
    const title = options.length ? options.map((o) => attrs[o.name]).join(" / ") : str(v.title, 80);
    return [{ id, title, attrs, sku: str(v.sku, 60), price: int(v.price ?? 0), rewardPoints: int(v.rewardPoints ?? 0, 0, 1000000), onHand: int(v.onHand ?? 0, 0, 100000), inventoryUnit: str(v.inventoryUnit, 30) || "عدد", baseUnitAmount: int(v.baseUnitAmount ?? 1, 1, 1_000_000_000), isActive: v.isActive !== false, isSellable: v.isSellable !== false }];
  }).filter((v) => v.title).slice(0, 60) : [];
  const variantKey = (attrs: Record<string, string>) => JSON.stringify(options.map((option) => attrs[option.name] ?? ""));
  const combos = new Set(variants.map((v) => variantKey(v.attrs)));
  if (options.length && combos.size !== variants.length) throw new HttpError(400, "ترکیب تکراری در تنوع‌ها وجود دارد");
  if (options.length) {
    let expected: Record<string, string>[] = [{}];
    for (const option of options) expected = expected.flatMap((attrs) => option.values.map((value) => ({ ...attrs, [option.name]: value })));
    if (expected.length > 60) throw new HttpError(400, "حداکثر ۶۰ ترکیب تنوع قابل تعریف است؛ تعداد مقادیر پارامترها را کمتر کنید");
  }
  return {
    data: {
      nameFa, nameEn: str(b.nameEn, 200) || null, sku, partNumber, normalizedPn: normalizePn(partNumber), oemNumber: str(b.oemNumber, 80) || null,
      crossRefs, brand, manufacturer: str(b.manufacturer, 80) || null, country: str(b.country, 60) || null,
      categoryId: b.categoryId ? int(b.categoryId, 1) : null, authenticity,
      basePrice: int(b.basePrice ?? 0), compareAtPrice: int(b.compareAtPrice ?? 0),
      shortDesc: str(b.shortDesc, 500) || null, description: sanitizeRich(str(b.description, 100000)) || null, technicalReview: sanitizeRich(str(b.technicalReview, 100000)) || null,
      specs, compatibility, weight: b.weight ? int(b.weight, 0, 1000000) : null, barcode: str(b.barcode, 40) || null,
      seoTitle: str(b.seoTitle, 120) || null, metaDesc: str(b.metaDesc, 300) || null, seoKeywords, seoImageId: b.seoImageId ? int(b.seoImageId, 1) : null,
      slug: slugify(str(b.slug, 120) || `${str(b.nameEn, 120) || nameFa}-${sku}`),
      lowStockThreshold: b.lowStockThreshold !== undefined ? int(b.lowStockThreshold, 0, 10000) : 3,
      allowBackorder: b.allowBackorder === true,
      inventoryBaseUnit: ["عدد", "گرم", "میلی‌لیتر"].includes(String(b.inventoryBaseUnit)) ? String(b.inventoryBaseUnit) : "عدد",
      options, purchaseOptions, relatedProductIds, crossSellProductIds, productFaqs,
      deliveryEstimateEnabled: b.deliveryEstimateEnabled === true, deliveryMinDays, deliveryMaxDays,
      organicInfo: parseOrganic(b.organicInfo),
      videoMediaId: b.videoMediaId ? int(b.videoMediaId, 1) : null,
    },
    imageIds, variants, deletedVariantIds: [...deletedVariantIds],
    offer: b.offerPrice ? { price: int(b.offerPrice, 1), costPrice: b.offerCostPrice ? int(b.offerCostPrice, 1) : int(b.offerPrice, 1), stock: int(b.offerStock ?? 0, 0, 100000), shippingCost: int(b.offerShipping ?? 0), prepDays: int(b.offerPrepDays ?? 1, 0, 60), warranty: str(b.offerWarranty, 200) || null } : null,
  };
}

export async function saveProduct(ctx: Ctx & { userId: number }, u: SessionUser, body: Record<string, unknown>, id?: number) {
  const input = parseProductInput(body);
  const isSeller = !!u.sellerId && !u.staff;
  if (isSeller && u.sellerStatus !== "approved") throw new HttpError(403, "حساب تأمین‌کننده هنوز تأیید نشده است");
  if (!isSeller && !u.permissions.includes(id ? "PRODUCTS_EDIT" : "PRODUCTS_CREATE")) throw new HttpError(403, "دسترسی غیرمجاز");
  return db.transaction(async (tx) => {
    input.data.relatedProductIds = input.data.relatedProductIds.filter((x) => x !== id);
    input.data.crossSellProductIds = input.data.crossSellProductIds.filter((x) => x !== id);
    const linkedIds = [...new Set([...input.data.relatedProductIds, ...input.data.crossSellProductIds])];
    if (linkedIds.length) {
      const found = await tx.select({ id: products.id }).from(products).where(inArray(products.id, linkedIds));
      if (found.length !== linkedIds.length) throw new HttpError(400, "یکی از محصولات مرتبط انتخاب‌شده معتبر نیست");
    }
    if (input.data.seoImageId) {
      const [seoImg] = await tx.select({ id: media.id, uploadedBy: media.uploadedBy }).from(media).where(eq(media.id, input.data.seoImageId));
      if (!seoImg) throw new HttpError(400, "تصویر سئو معتبر نیست");
      if (isSeller && seoImg.uploadedBy !== u.id) throw new HttpError(403, "فقط تصویر آپلودشده توسط خودتان مجاز است");
      await tx.update(media).set({ isPublic: true }).where(eq(media.id, seoImg.id));
    }
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
      if (isSeller) { input.data.allowBackorder = old.allowBackorder; input.data.inventoryBaseUnit = old.inventoryBaseUnit; }
      else if (old.source !== "central") { input.data.allowBackorder = false; input.data.inventoryBaseUnit = old.inventoryBaseUnit; }
      if (old.inventoryBaseUnit !== input.data.inventoryBaseUnit) {
        const stockedVariants = await tx.select({ onHand: productVariants.onHand, reserved: productVariants.reserved }).from(productVariants).where(eq(productVariants.productId, id));
        if (old.onHand || old.reserved || stockedVariants.some((v) => v.onHand || v.reserved)) throw new HttpError(400, "واحد پایه را تا زمانی که موجودی محصول یا تنوع‌هایش صفر نشده تغییر ندهید");
      }
      const importantChanged = IMPORTANT.some((k) => JSON.stringify(old![k]) !== JSON.stringify(input.data[k]));
      const status = isSeller && importantChanged && old.status !== "draft" ? "pending" : old.status;
      await tx.update(products).set({ ...input.data, status, mainImageId: input.imageIds[0] ?? null, updatedAt: new Date() }).where(eq(products.id, id));
      productId = id;
      await audit(tx, ctx, old.basePrice !== input.data.basePrice ? "product.price_change" : "product.update", "product", id,
        { basePrice: old.basePrice, status: old.status, nameFa: old.nameFa }, { basePrice: input.data.basePrice, status, nameFa: input.data.nameFa });
    } else {
      const [p] = await tx.insert(products).values({
        ...input.data, allowBackorder: !isSeller && input.data.allowBackorder, status: isSeller ? "pending" : (body.status === "active" ? "active" : "draft"),
        source: isSeller ? "marketplace" : "central", ownerSellerId: isSeller ? u.sellerId : null, createdBy: u.id, mainImageId: input.imageIds[0] ?? null,
      }).returning();
      productId = p.id;
      await audit(tx, ctx, "product.create", "product", p.id, null, { sku: p.sku, status: p.status });
    }
    await tx.delete(productImages).where(eq(productImages.productId, productId));
    if (input.imageIds.length) await tx.insert(productImages).values(input.imageIds.map((m, i) => ({ productId, mediaId: m, sortOrder: i })));
    if (!isSeller) {
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, productId)).for("update");
      const availableForEdit = existing.filter((variant) => !variant.deletedAt);
      const removedIds = new Set(input.deletedVariantIds);
      if ([...removedIds].some((variantId) => !availableForEdit.some((variant) => variant.id === variantId))) throw new HttpError(400, "شناسه یکی از تنوع‌های حذف‌شده معتبر نیست");
      const keep = new Set<number>();
      for (const v of input.variants) {
        const current = v.id ? availableForEdit.find((e) => e.id === v.id) : undefined;
        if (v.id && !current) throw new HttpError(400, "تنوع انتخاب‌شده برای ویرایش معتبر نیست");
        if (current) {
          if ((current.onHand || current.reserved) && (v.inventoryUnit !== current.inventoryUnit || v.baseUnitAmount !== current.baseUnitAmount)) throw new HttpError(400, `واحد یا ضریب تبدیل تنوع «${current.title}» تا زمان صفرشدن موجودی آن قابل تغییر نیست`);
          keep.add(current.id);
          await tx.update(productVariants).set({ title: v.title, attrs: v.attrs, sku: v.sku, price: v.price, rewardPoints: v.rewardPoints, inventoryUnit: v.inventoryUnit, baseUnitAmount: v.baseUnitAmount, isActive: v.isActive, isSellable: v.isSellable }).where(eq(productVariants.id, current.id));
        } else {
          const [nv] = await tx.insert(productVariants).values({ productId, title: v.title, attrs: v.attrs, sku: v.sku || `${input.data.sku}-${existing.length + keep.size + 1}`, price: v.price, rewardPoints: v.rewardPoints, inventoryUnit: v.inventoryUnit, baseUnitAmount: v.baseUnitAmount, onHand: v.onHand, isActive: v.isActive, isSellable: v.isSellable }).returning();
          if (v.onHand > 0) await tx.insert(stockMovements).values({ productId, variantId: nv.id, type: "initial", qty: v.onHand, userId: ctx.userId, note: "موجودی اولیه تنوع" });
        }
      }
      for (const e of availableForEdit) if (removedIds.has(e.id) || !keep.has(e.id)) await tx.update(productVariants).set({ isActive: false, deletedAt: new Date() }).where(eq(productVariants.id, e.id));
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

/** Stock receipt/adjustment targets either a simple product or one exact variant. */
export async function receiveStock(ctx: Ctx & { userId: number }, productId: number, qty: number, unitCost: number, freight: number, customs: number, note: string, variantId?: number, receipt?: { type: "purchase" | "consignment"; partyId: number; invoiceNumber: string; paymentLocation: string; paymentTrackingNumber: string; paidAmount: number }) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!p) throw new HttpError(404, "محصول یافت نشد");
    if (qty === 0) throw new HttpError(400, "تعداد نامعتبر");
    const variants = await tx.select().from(productVariants).where(eq(productVariants.productId, productId)).for("update");
    if (variants.length && !variantId) throw new HttpError(400, "برای این محصول باید تنوع دقیق انبار را انتخاب کنید");
    const stockVariant = variantId ? variants.find((variant) => variant.id === variantId) : undefined;
    if (variantId && !stockVariant) throw new HttpError(404, "تنوع این محصول یافت نشد");
    if (stockVariant?.deletedAt && (qty > 0 || receipt)) throw new HttpError(400, "تنوع حذف‌شده فقط برای تعدیل خروج موجودی باقی‌مانده قابل استفاده است");
    if (receipt && qty < 0) throw new HttpError(400, "رسید خرید یا امانی باید با مقدار مثبت ثبت شود");
    if (qty > 0) {
      const landed = unitCost * qty + freight + customs;
      let receiptId: number | null = null;
      let partyDetailId: number | null = null;
      let receiptPartyName = "";
      if (receipt) {
        if (receipt.paidAmount < 0 || receipt.paidAmount > landed) throw new HttpError(400, "مبلغ پرداخت‌شده باید بین صفر و جمع فاکتور باشد");
        if (receipt.paidAmount > 0 && !receipt.paymentLocation) throw new HttpError(400, "محل پرداخت را وارد کنید");
        const detail = await ensureInventoryPartyDetail(tx, receipt.partyId);
        partyDetailId = detail.id;
        receiptPartyName = detail.name;
        const [savedReceipt] = await tx.insert(inventoryReceipts).values({ number: genNumber("IR"), type: receipt.type, partyId: receipt.partyId, productId, variantId: stockVariant?.id ?? null, quantity: qty, unitCost, freight, customs, total: landed, invoiceNumber: receipt.invoiceNumber || null, paymentLocation: receipt.paymentLocation || null, paymentTrackingNumber: receipt.paymentTrackingNumber || null, paidAmount: receipt.paidAmount, note: note || null, userId: ctx.userId }).returning({ id: inventoryReceipts.id });
        receiptId = savedReceipt.id;
      }
      if (stockVariant) {
        const oldCost = stockVariant.costPrice ?? p.avgCost;
        const [{ qty: consignedInStock = 0 } = {}] = await tx.select({ qty: sql<number>`coalesce(sum(${inventoryConsignmentLots.remainingQty}),0)` }).from(inventoryConsignmentLots).where(eq(inventoryConsignmentLots.variantId, stockVariant.id));
        const ownedInStock = Math.max(0, stockVariant.onHand - Number(consignedInStock));
        const newAvg = receipt?.type === "consignment" ? oldCost : Math.round((ownedInStock * oldCost + landed) / (ownedInStock + qty));
        await tx.update(productVariants).set({ onHand: stockVariant.onHand + qty, costPrice: newAvg, isActive: true }).where(eq(productVariants.id, stockVariant.id));
        await tx.update(products).set({ status: p.status === "out_of_stock" ? "active" : p.status, updatedAt: new Date() }).where(eq(products.id, productId));
        await tx.insert(stockMovements).values({ productId, variantId: stockVariant.id, type: receipt?.type === "consignment" ? "consignment_in" : "purchase_in", qty, unitCost: receipt?.type === "consignment" ? unitCost : Math.round(landed / qty), refType: receiptId ? "inventory_receipt" : "purchase", refId: receiptId, note: receipt?.type === "consignment" ? `امانی از ${receiptPartyName} · ${note}` : note, userId: ctx.userId });
        if (receipt?.type === "consignment") await tx.insert(inventoryConsignmentLots).values({ receiptId: receiptId!, partyId: receipt.partyId, productId, variantId: stockVariant.id, initialQty: qty, remainingQty: qty, unitCost });
        await audit(tx, ctx, "inventory.receive_variant", "product_variant", stockVariant.id, { onHand: stockVariant.onHand, costPrice: stockVariant.costPrice }, { onHand: stockVariant.onHand + qty, costPrice: newAvg, note });
      } else {
        const [{ qty: consignedInStock = 0 } = {}] = await tx.select({ qty: sql<number>`coalesce(sum(${inventoryConsignmentLots.remainingQty}),0)` }).from(inventoryConsignmentLots).where(and(eq(inventoryConsignmentLots.productId, productId), sql`${inventoryConsignmentLots.variantId} is null`));
        const ownedInStock = Math.max(0, p.onHand - Number(consignedInStock));
        const newAvg = receipt?.type === "consignment" ? p.avgCost : Math.round((ownedInStock * p.avgCost + landed) / (ownedInStock + qty));
        await tx.update(products).set({ onHand: p.onHand + qty, avgCost: newAvg, status: p.status === "out_of_stock" ? "active" : p.status }).where(eq(products.id, productId));
        await tx.insert(stockMovements).values({ productId, type: receipt?.type === "consignment" ? "consignment_in" : "purchase_in", qty, unitCost: receipt?.type === "consignment" ? unitCost : Math.round(landed / qty), refType: receiptId ? "inventory_receipt" : "purchase", refId: receiptId, note: receipt?.type === "consignment" ? `امانی از ${receiptPartyName} · ${note}` : note, userId: ctx.userId });
        if (receipt?.type === "consignment") await tx.insert(inventoryConsignmentLots).values({ receiptId: receiptId!, partyId: receipt.partyId, productId, variantId: null, initialQty: qty, remainingQty: qty, unitCost });
        await audit(tx, ctx, "inventory.receive", "product", productId, { onHand: p.onHand, avgCost: p.avgCost }, { onHand: p.onHand + qty, avgCost: newAvg });
      }
      if (receipt) {
        if (receipt.type === "purchase") {
          const entry = await postJournal(tx, `خرید انبار ${receipt.invoiceNumber || receiptId} · ${p.nameFa}`, [
            { code: "1201", debit: landed, description: `رسید ${qty} واحد کالا` }, { code: "2104", credit: landed, detail1Id: partyDetailId, description: `فاکتور ${receipt.invoiceNumber || "بدون شماره"}` },
          ], { type: "inventory_receipt", id: receiptId! }, ctx.userId);
          if (entry) await tx.update(inventoryReceipts).set({ journalEntryId: entry.id }).where(eq(inventoryReceipts.id, receiptId!));
        } else {
          // Consigned stock is held by the store but is not yet a store asset or payable.
          await tx.insert(accounts).values([
            { code: "8101", name: "کالای امانی نزد فروشگاه (انتظامی)", level: "subsidiary", type: "memorandum" },
            { code: "8201", name: "مالکیت دیگران بر کالای امانی (انتظامی)", level: "subsidiary", type: "memorandum" },
          ]).onConflictDoNothing({ target: accounts.code });
          const value = unitCost * qty;
          const entry = await postJournal(tx, `دریافت امانی انبار ${receipt.invoiceNumber || receiptId} · ${p.nameFa}`, [
            { code: "8101", debit: value, description: `دریافت ${qty} واحد امانی` },
            { code: "8201", credit: value, detail1Id: partyDetailId, description: `مالک: ${receiptPartyName}` },
          ], { type: "inventory_receipt", id: receiptId! }, ctx.userId);
          if (entry) await tx.update(inventoryReceipts).set({ journalEntryId: entry.id }).where(eq(inventoryReceipts.id, receiptId!));
        }
        if (receipt.paidAmount > 0) {
          const paymentEntry = await postJournal(tx, `پرداخت فاکتور خرید ${receipt.invoiceNumber || receiptId} · ${receipt.paymentLocation}`, [
            { code: "2104", debit: receipt.paidAmount, detail1Id: partyDetailId }, { code: "1101", credit: receipt.paidAmount, description: `${receipt.paymentLocation}${receipt.paymentTrackingNumber ? ` · پیگیری ${receipt.paymentTrackingNumber}` : ""}` },
          ], { type: "inventory_receipt_payment", id: receiptId! }, ctx.userId);
          await tx.insert(inventorySupplierPayments).values({ partyId: receipt.partyId, amount: receipt.paidAmount, paymentLocation: receipt.paymentLocation, trackingNumber: receipt.paymentTrackingNumber || null, note: `پرداخت اولیه فاکتور ${receipt.invoiceNumber || receiptId}`, journalEntryId: paymentEntry?.id ?? null, userId: ctx.userId });
        }
      } else if (!receipt) {
        // Keep compatibility with existing system-generated stock initialization calls.
        await postJournal(tx, `خرید و ورود کالا ${p.sku}`, [
          { code: "1201", debit: landed }, { code: "2104", credit: unitCost * qty }, { code: "1101", credit: freight + customs, description: "حمل و گمرک" },
        ], { type: "product", id: productId }, ctx.userId);
      }
    } else {
      const out = -qty;
      if (stockVariant) {
        if (stockVariant.onHand - stockVariant.reserved < out) throw new HttpError(400, `موجودی آزاد این تنوع ${stockVariant.onHand - stockVariant.reserved} ${stockVariant.inventoryUnit} است`);
        const cost = stockVariant.costPrice ?? p.avgCost;
        const consigned = await consumeConsignmentLots(tx, productId, stockVariant.id, out);
        const consignedQty = consigned.reduce((sum, item) => sum + item.quantity, 0);
        const consignedCost = consigned.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
        await tx.update(productVariants).set({ onHand: stockVariant.onHand - out }).where(eq(productVariants.id, stockVariant.id));
        await tx.insert(stockMovements).values({ productId, variantId: stockVariant.id, type: "adjust_out", qty, unitCost: Math.round((cost * (out - consignedQty) + consignedCost) / out), note, userId: ctx.userId });
        if (consigned.length) await postConsignmentPayables(tx, consigned, `خروج کالای امانی از انبار ${p.sku}`, { type: "inventory_adjustment", id: productId }, ctx.userId);
        const ownedCost = cost * (out - consignedQty);
        if (ownedCost) await postJournal(tx, `کسری/ضایعات انبار ${p.sku} · ${stockVariant.title}`, [{ code: "5101", debit: ownedCost }, { code: "1201", credit: ownedCost }], { type: "product", id: productId }, ctx.userId);
        await audit(tx, ctx, "inventory.adjust_variant", "product_variant", stockVariant.id, { onHand: stockVariant.onHand }, { onHand: stockVariant.onHand - out, note });
      } else {
        if (p.onHand - p.reserved < out) throw new HttpError(400, `موجودی آزاد ${p.onHand - p.reserved} ${p.inventoryBaseUnit} است`);
        const consigned = await consumeConsignmentLots(tx, productId, null, out);
        const consignedQty = consigned.reduce((sum, item) => sum + item.quantity, 0);
        const consignedCost = consigned.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
        await tx.update(products).set({ onHand: p.onHand - out }).where(eq(products.id, productId));
        await tx.insert(stockMovements).values({ productId, type: "adjust_out", qty, unitCost: Math.round((p.avgCost * (out - consignedQty) + consignedCost) / out), note, userId: ctx.userId });
        if (consigned.length) await postConsignmentPayables(tx, consigned, `خروج کالای امانی از انبار ${p.sku}`, { type: "inventory_adjustment", id: productId }, ctx.userId);
        const ownedCost = p.avgCost * (out - consignedQty);
        if (ownedCost) await postJournal(tx, `کسری/ضایعات انبار ${p.sku}`, [{ code: "5101", debit: ownedCost }, { code: "1201", credit: ownedCost }], { type: "product", id: productId }, ctx.userId);
        await audit(tx, ctx, "inventory.adjust", "product", productId, { onHand: p.onHand }, { onHand: p.onHand - out, note });
      }
    }
  });
}

/** Convert bulk stock from one variant into packed stock of another variant. */
export async function repackStock(ctx: Ctx & { userId: number }, input: { productId: number; sourceVariantId: number; targetVariantId: number; inputQty: number; outputQty: number; note: string }) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, input.productId)).for("update");
    if (!p || p.source !== "central") throw new HttpError(404, "محصول انبار مرکزی یافت نشد");
    if (input.sourceVariantId === input.targetVariantId) throw new HttpError(400, "تنوع مبدأ و مقصد باید متفاوت باشند");
    const pair = await tx.select().from(productVariants).where(inArray(productVariants.id, [input.sourceVariantId, input.targetVariantId])).orderBy(productVariants.id).for("update");
    const source = pair.find((v) => v.id === input.sourceVariantId);
    const target = pair.find((v) => v.id === input.targetVariantId);
    if (!source || !target || source.productId !== p.id || target.productId !== p.id || !target.isActive || target.deletedAt) throw new HttpError(400, "تنوع مبدأ یا مقصد معتبر نیست");
    const { inputQty, outputQty } = input;
    if (!Number.isInteger(inputQty) || !Number.isInteger(outputQty) || inputQty < 1 || outputQty < 1 || inputQty > 100000 || outputQty > 100000) throw new HttpError(400, "مقدار مصرف و تولید باید عدد صحیح مثبت باشد");
    if (source.onHand - source.reserved < inputQty) throw new HttpError(400, `موجودی آزاد تنوع مبدأ ${source.onHand - source.reserved} ${source.inventoryUnit} است`);
    const consumedBase = inputQty * source.baseUnitAmount;
    const producedBase = outputQty * target.baseUnitAmount;
    if (producedBase > consumedBase) throw new HttpError(400, `مقدار تولیدشده از مصرف بیشتر است؛ مصرف معادل ${consumedBase.toLocaleString("fa-IR")} ${p.inventoryBaseUnit} و تولید ${producedBase.toLocaleString("fa-IR")} ${p.inventoryBaseUnit} می‌شود`);
    const sourceCost = source.costPrice ?? p.avgCost;
    const [job] = await tx.insert(inventoryRepackJobs).values({ productId: p.id, sourceVariantId: source.id, targetVariantId: target.id, inputQty, outputQty, note: input.note || null, userId: ctx.userId }).returning();
    const consigned = await consumeConsignmentLots(tx, p.id, source.id, inputQty, { action: "repack", refType: "repack", refId: job.id });
    const consignedQty = consigned.reduce((sum, item) => sum + item.quantity, 0);
    const consignedOutputQty = Math.min(outputQty, Math.round(outputQty * consignedQty / inputQty));
    const [{ qty: targetConsignedQty = 0 } = {}] = await tx.select({ qty: sql<number>`coalesce(sum(${inventoryConsignmentLots.remainingQty}),0)` }).from(inventoryConsignmentLots).where(eq(inventoryConsignmentLots.variantId, target.id));
    const targetOwnedQty = Math.max(0, target.onHand - Number(targetConsignedQty));
    const newOwnedQty = outputQty - consignedOutputQty;
    const targetCost = targetOwnedQty + newOwnedQty > 0 ? Math.round((targetOwnedQty * (target.costPrice ?? p.avgCost) + (inputQty - consignedQty) * sourceCost) / (targetOwnedQty + newOwnedQty)) : target.costPrice ?? p.avgCost;
    await tx.update(productVariants).set({ onHand: source.onHand - inputQty }).where(eq(productVariants.id, source.id));
    await tx.update(productVariants).set({ onHand: target.onHand + outputQty, costPrice: targetCost }).where(eq(productVariants.id, target.id));
    await transferConsignmentLots(tx, p.id, target.id, consigned, outputQty, inputQty);
    await tx.insert(stockMovements).values([
      { productId: p.id, variantId: source.id, type: "repack_out", qty: -inputQty, unitCost: sourceCost, refType: "repack", refId: job.id, note: input.note || "مصرف در بسته‌بندی", userId: ctx.userId },
      { productId: p.id, variantId: target.id, type: "repack_in", qty: outputQty, unitCost: targetCost, refType: "repack", refId: job.id, note: input.note || "تولید از بسته‌بندی", userId: ctx.userId },
    ]);
    await audit(tx, ctx, "inventory.repack", "inventory_repack", job.id, null, { productId: p.id, sourceVariantId: source.id, inputQty, targetVariantId: target.id, outputQty, consumedBase, producedBase });
    return { id: job.id };
  });
}
