import { and, desc, eq, gt, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import {
  media, mediaVariants, notifications, productImages, productViewLogs, productViewPresence, productPriceHistory, productAlertVerifications, productAlertSubscriptions, productAlertEvents, productAlertDeliveries, ticketDepartments, detailAccounts, products, productVariants, sellerOffers, sellers, supplyRequests, ticketMessages, tickets, users, wallets, auditLogs, blogPosts,
} from "@/db/schema";
import { createSession, destroySession, getUser, hashPassword, rateLimit, requireApi, verifyPassword } from "../auth";
import { audit } from "../audit";
import { getSettings } from "../settings";
import { HttpError, genNumber, int, normalizePn, str } from "../util";
import { cancelOrder, confirmReceipt, payOrder, placeOrder, quoteCart, sanitizeCart } from "../services/orders";
import { customerSupplyAction } from "../services/supply";
import { sendSms, sendDirectSms } from "../sms";
import { dispatchProductAlertEvents } from "../services/product-alerts";
import { body, idParam, type Route } from "./router";
import { newMediaPath, readMediaFile, removeMediaFile, writeMediaFile } from "../media-storage";
import { preferredImageFormats } from "../media-processing";
import { applyUploadWatermark } from "../watermark";
import { analyticsSessionFromCookie } from "../analytics";

function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.length > 5 && buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buf.length > 6 && (buf.subarray(0, 6).toString() === "GIF87a" || buf.subarray(0, 6).toString() === "GIF89a")) return "image/gif";
  if (buf.length > 12 && buf.subarray(4, 8).toString() === "ftyp") return "video/mp4";
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WAVE") return "audio/wav";
  if (buf.length > 4 && buf.subarray(0, 4).toString() === "OggS") return "audio/ogg";
  if (buf.length > 3 && buf.subarray(0, 3).toString() === "ID3") return "audio/mpeg";
  if (buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

function readAttribution(req: Request) {
  const cookie = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("sbz_attribution="));
  if (!cookie) return null;
  try {
    const value = JSON.parse(decodeURIComponent(cookie.slice("sbz_attribution=".length))) as Record<string, unknown>;
    const clean = (input: unknown, max: number) => typeof input === "string" ? input.trim().slice(0, max) : undefined;
    const source = clean(value.source, 100);
    if (!source) return null;
    const rawHost = clean(value.referrerHost, 190);
    let referrerHost: string | undefined;
    if (rawHost) {
      try { referrerHost = new URL(`https://${rawHost}`).hostname.slice(0, 190); } catch { /* Ignore invalid client input. */ }
    }
    const rawPath = clean(value.landingPath, 700);
    return {
      source,
      ...(referrerHost ? { referrerHost } : {}),
      ...(clean(value.utmSource, 100) ? { utmSource: clean(value.utmSource, 100) } : {}),
      ...(clean(value.utmMedium, 100) ? { utmMedium: clean(value.utmMedium, 100) } : {}),
      ...(clean(value.utmCampaign, 150) ? { utmCampaign: clean(value.utmCampaign, 150) } : {}),
      ...(rawPath?.startsWith("/") ? { landingPath: rawPath } : {}),
    };
  } catch { return null; }
}

function readAffiliateCode(req: Request) {
  const cookie = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("org_affiliate="));
  if (!cookie) return null;
  try {
    const code = decodeURIComponent(cookie.slice("org_affiliate=".length)).trim().toUpperCase();
    return /^[A-Z0-9_-]{5,32}$/.test(code) ? code : null;
  } catch { return null; }
}

export const publicRoutes: Route[] = [
  { method: "POST", pattern: "products/:id/views", handler: async (req, p, m) => {
    const id = idParam(p.id), b = await body(req);
    const [prod] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, id), inArray(products.status, ["active", "out_of_stock"])));
    if (!prod) throw new HttpError(404, "محصول یافت نشد");
    rateLimit(`product-view:${id}:${m.ip}`, 180, 60_000);
    const sessionId = str(b.sessionId, 80);
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId)) throw new HttpError(400, "شناسه بازدید معتبر نیست");
    after(async () => {
      try {
        const writes: Promise<unknown>[] = [db.insert(productViewPresence).values({ productId: id, sessionId, ip: m.ip.slice(0, 100), lastSeenAt: new Date() }).onConflictDoUpdate({
          target: [productViewPresence.productId, productViewPresence.sessionId],
          set: { ip: m.ip.slice(0, 100), lastSeenAt: new Date() },
        })];
        if (b.trackView === true) writes.push(db.insert(productViewLogs).values({ productId: id, ip: m.ip.slice(0, 100), userAgent: m.ua?.slice(0, 500) ?? null }));
        await Promise.all(writes);
        await dispatchProductAlertEvents(6);
      } catch (error) {
        console.error("Failed to save product view", { productId: id, error });
      }
    });
    return { ok: true };
  } },
  { method: "GET", pattern: "products/:id/viewers", handler: async (_req, p, m) => {
    const id = idParam(p.id);
    rateLimit(`product-viewers:${id}:${m.ip}`, 60, 60_000);
    const settings = await getSettings();
    if (!settings.productLiveViewers) return { enabled: false, count: 0 };
    const cutoff = new Date(Date.now() - 75_000);
    const [row] = await db.select({ count: sql<number>`count(distinct ${productViewPresence.sessionId})::int` }).from(productViewPresence)
      .where(and(eq(productViewPresence.productId, id), gt(productViewPresence.lastSeenAt, cutoff)));
    return { enabled: true, count: Number(row?.count ?? 0) };
  } },
  { method: "GET", pattern: "admin/products/:id/views", handler: async (_req, p) => {
    await requireApi("PRODUCTS_VIEW");
    const id = idParam(p.id);
    const [prod] = await db.select({ id: products.id }).from(products).where(eq(products.id, id));
    if (!prod) throw new HttpError(404, "محصول یافت نشد");
    const [[{ total = 0 } = {}], logs] = await Promise.all([
      db.select({ total: sql<number>`count(*)::int` }).from(productViewLogs).where(eq(productViewLogs.productId, id)),
      db.select().from(productViewLogs).where(eq(productViewLogs.productId, id)).orderBy(desc(productViewLogs.viewedAt)).limit(250),
    ]);
    return { total, logs };
  } },
  { method: "POST", pattern: "auth/login", handler: async (req, _p, m) => {
    const b = await body(req);
    rateLimit(`login:${m.ip}`, 10, 60_000);
    const phone = str(b.phone, 20);
    const [u] = await db.select().from(users).where(eq(users.phone, phone));
    if (!u || !u.isActive || !verifyPassword(str(b.password, 200), u.passwordHash)) throw new HttpError(401, "شماره موبایل یا رمز عبور اشتباه است");
    await createSession(u.id, m.ip, m.ua, true);
    await audit(db, { userId: u.id, ...m }, "auth.login", "user", u.id);
    const me = await db.select().from(sellers).where(eq(sellers.userId, u.id));
    return { ok: true, role: u.role, redirect: u.role === "customer" ? "/customer" : me.length ? "/seller" : "/admin" };
  } },
  { method: "POST", pattern: "auth/register", handler: async (req, _p, m) => {
    const b = await body(req);
    rateLimit(`reg:${m.ip}`, 5, 60_000);
    const name = str(b.name, 100), phone = str(b.phone, 20), password = str(b.password, 200);
    if (!name || !/^09\d{9}$/.test(phone) || password.length < 8) throw new HttpError(400, "نام، موبایل معتبر (09xxxxxxxxx) و رمز حداقل ۸ کاراکتر الزامی است");
    const stg = await getSettings();
    const asSeller = b.asSeller === true && !!stg.multiVendor && !!stg.allowSellerSignup;
    const u = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name, phone, passwordHash: hashPassword(password), role: asSeller ? "seller" : "customer" }).returning();
      if (asSeller) {
        const [s] = await tx.insert(sellers).values({ userId: u.id, shopName: str(b.shopName, 100) || name, city: str(b.city, 50) || "تهران", status: "pending" }).returning();
        await tx.insert(wallets).values({ sellerId: s.id });
        const [parent] = await tx.select().from(detailAccounts).where(eq(detailAccounts.code, "S"));
        await tx.insert(detailAccounts).values({ code: `S-${s.id}`, name: s.shopName, level: 3, parentId: parent?.id ?? null });
      }
      await audit(tx, { userId: u.id, ...m }, "auth.register", "user", u.id, null, { role: u.role });
      return u;
    });
    await createSession(u.id, m.ip, m.ua);
    return { ok: true, redirect: asSeller ? "/seller" : "/customer" };
  } },
  { method: "POST", pattern: "auth/logout", handler: async (_r, _p, m) => {
    const u = await getUser();
    if (u) await audit(db, { userId: u.id, ...m }, "auth.logout", "user", u.id);
    await destroySession();
    return { ok: true };
  } },
  { method: "GET", pattern: "auth/me", handler: async () => ({ user: await getUser() }) },

  { method: "GET", pattern: "products/:id", handler: async (_r, p) => {
    const id = idParam(p.id);
    const [prod] = await db.select().from(products).where(and(eq(products.id, id), inArray(products.status, ["active", "out_of_stock"])));
    if (!prod) throw new HttpError(404, "محصول یافت نشد");
    const images = await db.select({ mediaId: productImages.mediaId }).from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.sortOrder);
    const variants = await db.select().from(productVariants).where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true), isNull(productVariants.deletedAt)));
    const offers = await db.select({ o: sellerOffers, s: sellers }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
      .where(and(eq(sellerOffers.productId, id), eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false)));
    return {
      product: { ...prod, basePrice: prod.inquiryOnly ? 0 : prod.basePrice, compareAtPrice: prod.inquiryOnly ? 0 : prod.compareAtPrice, avgCost: undefined, createdBy: undefined, available: prod.onHand - prod.reserved },
      images: images.map((i) => i.mediaId),
      variants: variants.map((v) => ({ id: v.id, title: v.title, price: prod.inquiryOnly || v.inquiryOnly ? 0 : v.price, compareAtPrice: prod.inquiryOnly || v.inquiryOnly ? 0 : v.compareAtPrice, inquiryOnly: prod.inquiryOnly || v.inquiryOnly, available: v.onHand - v.reserved, isSellable: v.isSellable })),
      offers: offers.map(({ o, s }) => ({ id: o.id, sellerId: s.id, shopName: s.shopName, rating: s.rating, city: o.shipCity ?? s.city, price: prod.inquiryOnly ? 0 : o.salePrice ?? o.price, listPrice: prod.inquiryOnly ? 0 : o.price, available: o.stock - o.reserved, shippingCost: o.shippingCost, prepDays: o.prepDays, warranty: o.warranty, isBuyBox: o.isBuyBox, condition: o.condition }))
        .sort((a, b) => Number(b.isBuyBox) - Number(a.isBuyBox) || a.price - b.price),
    };
  } },
  { method: "GET", pattern: "products/:id/price-history", handler: async (_req, p) => {
    const id = idParam(p.id);
    const [product] = await db.select({ id: products.id, inquiryOnly: products.inquiryOnly }).from(products).where(and(eq(products.id, id), inArray(products.status, ["active", "out_of_stock"])));
    if (!product) throw new HttpError(404, "محصول یافت نشد");
    if (product.inquiryOnly) return { trackedSince: new Date().toISOString(), series: [] };
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const rows = await db.select({ history: productPriceHistory, variantTitle: productVariants.title, shopName: sellers.shopName })
      .from(productPriceHistory)
      .leftJoin(productVariants, eq(productVariants.id, productPriceHistory.variantId))
      .leftJoin(sellerOffers, eq(sellerOffers.id, productPriceHistory.sellerOfferId))
      .leftJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
      .where(and(eq(productPriceHistory.productId, id), gt(productPriceHistory.createdAt, since), or(ne(productPriceHistory.scope, "variant"), eq(productVariants.inquiryOnly, false)), or(ne(productPriceHistory.scope, "seller_offer"), and(eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false)))))
      .orderBy(desc(productPriceHistory.createdAt)).limit(2000);
    const groups = new Map<string, { key: string; label: string; entries: { at: string; price: number; referencePrice: number; source: string }[] }>();
    for (const { history: h, variantTitle, shopName } of [...rows].reverse()) {
      const key = h.scope === "product" ? "product" : h.scope === "variant" ? `variant:${h.variantId}` : `offer:${h.sellerOfferId}`;
      const label = h.scope === "product" ? "قیمت پایه" : h.scope === "variant" ? `تنوع ${variantTitle ?? h.variantId}` : `پیشنهاد ${shopName ?? "فروشنده"}`;
      const group = groups.get(key) ?? { key, label, entries: [] };
      group.entries.push({ at: h.createdAt.toISOString(), price: h.price, referencePrice: h.referencePrice, source: h.source });
      groups.set(key, group);
    }
    return { trackedSince: since.toISOString(), series: [...groups.values()] };
  } },
  { method: "POST", pattern: "product-alerts/request-code", handler: async (req, _p, m) => {
    const b = await body(req), phone = normalizePn(str(b.phone, 20)), productId = idParam(String(b.productId ?? ""));
    const variantId = b.variantId ? idParam(String(b.variantId)) : 0;
    const alertRestock = b.alertRestock === true, alertPriceDrop = b.alertPriceDrop === true;
    if (!/^09\d{9}$/.test(phone) || (!alertRestock && !alertPriceDrop) || b.consent !== true) throw new HttpError(400, "شماره همراه معتبر، انتخاب نوع اعلان و رضایت پیامکی الزامی است");
    rateLimit(`product-alert-code:${m.ip}:${phone}`, 3, 10 * 60_000);
    const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), inArray(products.status, ["active", "out_of_stock"])));
    if (!product) throw new HttpError(404, "محصول یافت نشد");
    if (variantId) {
      const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId), eq(productVariants.isActive, true), isNull(productVariants.deletedAt)));
      if (!variant) throw new HttpError(400, "تنوع انتخاب‌شده معتبر نیست");
    }
    const user = await getUser();
    if (user && user.phone !== phone) throw new HttpError(400, "برای ثبت اعلان در حساب واردشده، شماره همان حساب را وارد کنید");
    const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0"), salt = randomBytes(16).toString("hex");
    const pepper = process.env.OTP_SECRET || process.env.DATABASE_URL || "otp";
    const [verification] = await db.insert(productAlertVerifications).values({ phone, productId, variantId, codeHash: createHmac("sha256", pepper).update(`${salt}:${code}`).digest("hex"), salt, alertRestock, alertPriceDrop, expiresAt: new Date(Date.now() + 5 * 60_000) }).returning({ id: productAlertVerifications.id });
    const status = await sendDirectSms("otp_login", phone, "کد تأیید اعلان محصول شما: {code} — اعتبار: ۵ دقیقه", { code });
    if (status !== "sent") {
      await db.delete(productAlertVerifications).where(eq(productAlertVerifications.id, verification.id));
      throw new HttpError(503, status === "simulated" ? "پنل پیامک در حالت شبیه‌سازی است؛ برای تأیید واقعی شماره، سرویس پیامک را پیکربندی کنید" : "ارسال کد تأیید پیامکی انجام نشد؛ تنظیمات پنل پیامک را بررسی کنید");
    }
    return { ok: true, verificationId: verification.id, expiresIn: 300 };
  } },
  { method: "POST", pattern: "product-alerts/verify", handler: async (req, _p, m) => {
    const b = await body(req), phone = normalizePn(str(b.phone, 20)), verificationId = idParam(String(b.verificationId ?? "")), code = normalizePn(str(b.code, 12));
    rateLimit(`product-alert-verify:${m.ip}:${phone}`, 10, 10 * 60_000);
    const [v] = await db.select().from(productAlertVerifications).where(and(eq(productAlertVerifications.id, verificationId), eq(productAlertVerifications.phone, phone)));
    if (!v || v.verifiedAt || v.expiresAt < new Date() || v.attempts >= 5) throw new HttpError(400, "کد تأیید منقضی یا نامعتبر است؛ دوباره درخواست کد کنید");
    const pepper = process.env.OTP_SECRET || process.env.DATABASE_URL || "otp";
    const expected = Buffer.from(v.codeHash, "hex"), actual = Buffer.from(createHmac("sha256", pepper).update(`${v.salt}:${code}`).digest("hex"), "hex");
    if (!/^\d{6}$/.test(code) || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await db.update(productAlertVerifications).set({ attempts: sql`${productAlertVerifications.attempts} + 1` }).where(eq(productAlertVerifications.id, v.id));
      throw new HttpError(400, "کد تأیید اشتباه است");
    }
    const user = await getUser();
    const token = randomBytes(32).toString("base64url"), now = new Date();
    const [subscription] = await db.insert(productAlertSubscriptions).values({ userId: user?.phone === phone ? user.id : null, phone, productId: v.productId, variantId: v.variantId, alertRestock: v.alertRestock, alertPriceDrop: v.alertPriceDrop, consentAt: now, token, active: true, updatedAt: now })
      .onConflictDoUpdate({ target: [productAlertSubscriptions.phone, productAlertSubscriptions.productId, productAlertSubscriptions.variantId], set: { userId: user?.phone === phone ? user.id : null, alertRestock: v.alertRestock, alertPriceDrop: v.alertPriceDrop, consentAt: now, token, active: true, updatedAt: now } }).returning({ id: productAlertSubscriptions.id });
    await db.update(productAlertVerifications).set({ verifiedAt: now }).where(eq(productAlertVerifications.id, v.id));
    return { ok: true, id: subscription.id, manageUrl: `/customer/alerts?unsubscribe=${token}` };
  } },
  { method: "GET", pattern: "product-alerts/mine", handler: async () => {
    const u = await requireApi();
    const rows = await db.select({ id: productAlertSubscriptions.id, productId: productAlertSubscriptions.productId, productName: products.nameFa, slug: products.slug, variantId: productAlertSubscriptions.variantId, variantTitle: productVariants.title, phone: productAlertSubscriptions.phone, alertRestock: productAlertSubscriptions.alertRestock, alertPriceDrop: productAlertSubscriptions.alertPriceDrop, active: productAlertSubscriptions.active, createdAt: productAlertSubscriptions.createdAt })
      .from(productAlertSubscriptions).leftJoin(products, eq(products.id, productAlertSubscriptions.productId)).leftJoin(productVariants, eq(productVariants.id, productAlertSubscriptions.variantId)).where(eq(productAlertSubscriptions.userId, u.id)).orderBy(desc(productAlertSubscriptions.createdAt));
    const deliveries = rows.length ? await db.select({ subscriptionId: productAlertDeliveries.subscriptionId, status: productAlertDeliveries.status, createdAt: productAlertDeliveries.createdAt, productName: products.nameFa })
      .from(productAlertDeliveries).innerJoin(productAlertSubscriptions, eq(productAlertSubscriptions.id, productAlertDeliveries.subscriptionId)).innerJoin(productAlertEvents, eq(productAlertEvents.id, productAlertDeliveries.eventId)).innerJoin(products, eq(products.id, productAlertEvents.productId)).where(eq(productAlertSubscriptions.userId, u.id)).orderBy(desc(productAlertDeliveries.createdAt)).limit(100) : [];
    return { subscriptions: rows, deliveries };
  } },
  { method: "POST", pattern: "product-alerts/:id/cancel", handler: async (_req, p) => {
    const u = await requireApi(), id = idParam(p.id);
    const [row] = await db.update(productAlertSubscriptions).set({ active: false, updatedAt: new Date() }).where(and(eq(productAlertSubscriptions.id, id), eq(productAlertSubscriptions.userId, u.id))).returning({ id: productAlertSubscriptions.id });
    if (!row) throw new HttpError(404, "اشتراک اعلان یافت نشد");
    return { ok: true };
  } },
  { method: "POST", pattern: "product-alerts/unsubscribe", handler: async (req) => {
    const b = await body(req), token = str(b.token, 100);
    if (!token) throw new HttpError(400, "پیوند لغو اشتراک معتبر نیست");
    const [row] = await db.update(productAlertSubscriptions).set({ active: false, updatedAt: new Date() }).where(eq(productAlertSubscriptions.token, token)).returning({ id: productAlertSubscriptions.id });
    if (!row) throw new HttpError(404, "اشتراک فعالی با این پیوند یافت نشد");
    return { ok: true };
  } },
  { method: "POST", pattern: "cart/quote", handler: async (req) => {
    const b = await body(req);
    const items = sanitizeCart(b.items);
    const u = await getUser();
    return db.transaction((tx) => quoteCart(tx, items, false, { userId: u?.id ?? null, code: str(b.code, 30), city: str(b.city, 60), carrierId: b.carrierId ? int(b.carrierId, 1) : null, freightCollect: b.freightCollect === true, pickup: b.pickup === true }));
  } },

  { method: "GET", pattern: "media/library", handler: async (req) => {
    const u = await requireApi();
    const q = str(req.nextUrl.searchParams.get("q"), 100), type = str(req.nextUrl.searchParams.get("type"), 20), folder = req.nextUrl.searchParams.get("folder");
    const filters = [u.staff ? undefined : eq(media.uploadedBy, u.id), q ? ilike(media.filename, `%${q}%`) : undefined, type === "image" ? ilike(media.mime, "image/%") : undefined, folder === "root" ? isNull(media.folderId) : folder ? eq(media.folderId, int(folder, 1)) : undefined].filter(Boolean) as ReturnType<typeof eq>[];
    const rows = await db.select({ id: media.id, filename: media.filename, alt: media.alt, folderId: media.folderId, mime: media.mime, size: media.size, isPublic: media.isPublic, createdAt: media.createdAt }).from(media).where(filters.length ? and(...filters) : undefined).orderBy(desc(media.createdAt)).limit(120);
    return rows.map((row) => ({ ...row, url: `/api/media/${row.id}` }));
  } },
  { method: "GET", pattern: "media/:id", handler: async (req, p) => {
    const id = idParam(p.id);
    const [m] = await db.select({ id: media.id, mime: media.mime, size: media.size, uploadedBy: media.uploadedBy, isPublic: media.isPublic, storagePath: media.storagePath, externalUrl: media.externalUrl }).from(media).where(eq(media.id, id));
    if (!m) throw new HttpError(404, "یافت نشد");
    let pub = m.isPublic;
    if (!pub) pub = (await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.mediaId, id)).limit(1)).length > 0;
    if (!pub) pub = (await db.select({ id: blogPosts.id }).from(blogPosts).where(and(
      eq(blogPosts.status, "published"), isNull(blogPosts.deletedAt),
      sql`(${blogPosts.videoMediaId} = ${id} or ${blogPosts.audioMediaId} = ${id})`,
    )).limit(1)).length > 0;
    if (!pub) {
      const u = await getUser();
      if (!u || (u.id !== m.uploadedBy && !u.staff)) throw new HttpError(404, "یافت نشد");
    }
    let pathToRead = m.storagePath, contentType = m.mime;
    const requestedWidth = Number(req.nextUrl.searchParams.get("w"));
    if (m.mime.startsWith("image/") && [320, 640, 960, 1280, 1600].includes(requestedWidth)) {
      const formats = preferredImageFormats(req.headers.get("accept"));
      if (formats.length) {
        const candidates = formats.map((format) => `${requestedWidth}-${format}`);
        const candidatesRows = await db.select({ variant: mediaVariants.variant, storagePath: mediaVariants.storagePath, mime: mediaVariants.mime }).from(mediaVariants).where(and(eq(mediaVariants.mediaId, id), inArray(mediaVariants.variant, candidates)));
        const selected = candidates.map((candidate) => candidatesRows.find((row) => row.variant === candidate)).find(Boolean);
        if (selected) { pathToRead = selected.storagePath; contentType = selected.mime; }
      }
    }
    let content:Buffer;
    try{content=await readMediaFile(pathToRead)}catch{if(pathToRead!==m.storagePath){try{content=await readMediaFile(m.storagePath);contentType=m.mime}catch{throw new HttpError(404,"فایل در دایرکتوری مدیا یافت نشد")}}else if(m.externalUrl&&/^https:\/\//i.test(m.externalUrl))return Response.redirect(m.externalUrl,307);else throw new HttpError(404,"فایل در دایرکتوری مدیا یافت نشد")}
    const headers: Record<string, string> = {
      "Content-Type": contentType, "Cache-Control": pub ? "public, max-age=900" : "private, max-age=300", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Vary": "Accept",
      ...(m.mime === "application/pdf" ? { "Content-Disposition": `inline; filename="doc-${m.id}.pdf"`, "Content-Security-Policy": "sandbox" } : {}),
    };
    const range = req.headers.get("range");
    const rm = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (rm && (m.mime.startsWith("video/") || m.mime.startsWith("audio/"))) {
      let start = rm[1] ? Number(rm[1]) : Math.max(0, content.length - Number(rm[2] || 0));
      let end = rm[1] && rm[2] ? Number(rm[2]) : content.length - 1;
      end = Math.min(end, content.length - 1, start + 2 * 1024 * 1024 - 1);
      if (start >= content.length || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${content.length}` } });
      const chunk=content.subarray(start,end+1);
      start = Math.max(0, start);
      return new Response(new Uint8Array(chunk), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${content.length}`, "Content-Length": String(chunk.length) } });
    }
    return new Response(new Uint8Array(content), { headers: { ...headers, "Content-Length": String(content.length) } });
  } },
  { method: "POST", pattern: "media", handler: async (req, _p, m) => {
    const u = await requireApi();
    rateLimit(`upload:${u.id}`, 30, 60_000);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") throw new HttpError(400, "فایلی ارسال نشده است");
    const kind = String(form?.get("kind") ?? "image");
    const KINDS: Record<string, { types: string[]; mb: number; label: string; staffOnly?: boolean }> = {
      image: { types: ["image/jpeg", "image/png", "image/webp"], mb: 3, label: "JPG، PNG و WebP" },
      profile: { types: ["image/jpeg", "image/png", "image/webp"], mb: 3, label: "JPG، PNG و WebP" },
      document: { types: ["image/jpeg", "image/png", "image/webp", "application/pdf"], mb: 8, label: "JPG، PNG، WebP یا PDF" },
      video: { types: ["video/mp4", "video/webm"], mb: 40, label: "MP4 یا WebM" },
      audio: { types: ["audio/mpeg", "audio/wav", "audio/ogg"], mb: 40, label: "MP3، WAV یا OGG", staffOnly: true },
      hero: { types: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"], mb: 40, label: "تصویر، GIF یا ویدیو (MP4/WebM)", staffOnly: true },
      editor: { types: ["image/jpeg", "image/png", "image/webp", "image/gif"], mb: 3, label: "تصویر یا GIF" },
      library: { types: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "video/mp4", "video/webm"], mb: 40, label: "تصویر، PDF یا ویدیو", staffOnly: true },
    };
    const k = KINDS[kind] ?? KINDS.image;
    if (k.staffOnly && !u.staff) throw new HttpError(403, "دسترسی غیرمجاز");
    if (kind === "video" && !u.staff && !u.sellerId) throw new HttpError(403, "بارگذاری ویدیو فقط برای فروشندگان و مدیران مجاز است");
    if (!k.types.includes(file.type)) throw new HttpError(400, `فقط ${k.label} مجاز است`);
    if (file.size > k.mb * 1024 * 1024) throw new HttpError(400, `حداکثر حجم فایل ${k.mb.toLocaleString("fa-IR")} مگابایت است`);
    let buf: Buffer = Buffer.from(await file.arrayBuffer());
    const real = sniff(buf);
    if (!real || !k.types.includes(real) || (real.startsWith("video/") !== file.type.startsWith("video/"))) throw new HttpError(400, "محتوای فایل با نوع اعلام‌شده مطابقت ندارد");
    buf = await applyUploadWatermark(buf, real, kind);
    const filename = (file.name || "upload").replace(/[/\\]/g, "_").replace(/\.\.+/g, ".").replace(/[^\w.\-\u0600-\u06FF]/g, "_").slice(0, 100);
    const folderId = form?.get("folderId") ? int(form.get("folderId"), 1) : null;
    const storagePath=newMediaPath(filename);await writeMediaFile(storagePath,buf);
    let row:{id:number}|undefined;try{[row]=await db.insert(media).values({ filename, alt: str(form?.get("alt"), 190) || null, folderId, mime: real, size: buf.length, storagePath, uploadedBy: u.id, isPublic: kind === "editor" || kind === "library" || kind === "profile" }).returning({ id: media.id })}catch(error){await removeMediaFile(storagePath);throw error}if(!row){await removeMediaFile(storagePath);throw new HttpError(500,"ثبت فایل انجام نشد")}
    await audit(db, { userId: u.id, ...m }, "media.upload", "media", row.id, null, { filename, size: buf.length, kind });
    return { id: row.id, url: `/api/media/${row.id}`, mime: real };
  } },

  { method: "POST", pattern: "orders", handler: async (req, _p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const items = sanitizeCart(b.items);
    const a = (b.address ?? {}) as Record<string, unknown>;
    const fulfillmentType = b.fulfillmentType === "pickup" ? "pickup" : "delivery";
    const address = { fullName: str(a.fullName, 100) || u.name, phone: str(a.phone, 20) || u.phone, city: str(a.city, 60), address: str(a.address, 500), postalCode: str(a.postalCode, 20), latitude: str(a.latitude, 30), longitude: str(a.longitude, 30) };
    if (fulfillmentType === "delivery" && (!address.fullName || !address.phone || !address.city || address.address.length < 10)) throw new HttpError(400, "آدرس تحویل کامل نیست");
    const key = str(b.idempotencyKey, 100);
    if (key.length < 8) throw new HttpError(400, "کلید یکتا الزامی است");
    const recoveryKey = str(b.recoveryKey, 80);
    if (recoveryKey && !/^[\w-]{8,80}$/.test(recoveryKey)) throw new HttpError(400, "شناسه سبد نامعتبر است");
    let invoiceType: string | null = null, invoiceDetails: Record<string,string> | null = null;
    if (b.requestOfficialInvoice === true) {
      invoiceType = str(b.officialInvoiceType, 20);
      const [identity] = await db.select({name:users.name,nationalId:users.nationalId,companyName:users.companyName,companyNationalId:users.companyNationalId,companyManager:users.companyManager}).from(users).where(eq(users.id,u.id));
      if (invoiceType === "individual") {
        if (!identity?.nationalId || !/^\d{10}$/.test(identity.nationalId)) throw new HttpError(400,"برای فاکتور رسمی حقیقی، کد ملی معتبر را در پروفایل تکمیل کنید");
        invoiceDetails={name:identity.name,nationalId:identity.nationalId};
      } else if (invoiceType === "company") {
        if (!identity?.companyName || !identity.companyNationalId || !/^\d{11}$/.test(identity.companyNationalId) || !identity.companyManager) throw new HttpError(400,"برای فاکتور حقوقی، نام شرکت، شناسه ملی ۱۱ رقمی و نام مدیرعامل را در پروفایل تکمیل کنید");
        invoiceDetails={companyName:identity.companyName,companyNationalId:identity.companyNationalId,managerName:identity.companyManager};
      } else throw new HttpError(400,"نوع فاکتور رسمی را انتخاب کنید");
    }
    const order = await placeOrder({ userId: u.id, ...m }, items, address, `${u.id}:${key}`, { code: str(b.code, 30), carrierId: b.carrierId ? int(b.carrierId, 1) : null, freightCollect: b.freightCollect === true, recoveryKey, officialInvoiceType:invoiceType, officialInvoiceDetails:invoiceDetails, attribution: readAttribution(req), analyticsSessionId: analyticsSessionFromCookie(req.headers.get("cookie")), affiliateCode: readAffiliateCode(req), fulfillmentType, pickupCenterId: b.pickupCenterId ? int(b.pickupCenterId, 1) : null, pickupDate: str(b.pickupDate, 10), pickupTime: str(b.pickupTime, 5) });
    return { id: order.id, number: order.number, paid:order.paymentStatus==="paid", fulfillmentType: order.fulfillmentType, pickupCode: order.pickupCode };
  } },
  { method: "POST", pattern: "orders/:id/confirm", handler: async (_r, p, m) => {
    const u = await requireApi();
    await confirmReceipt({ userId: u.id, ...m }, idParam(p.id));
    return { ok: true };
  } },
  { method: "POST", pattern: "orders/:id/cancel", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    await cancelOrder({ userId: u.id, ...m }, idParam(p.id), { staff: false }, str(b.reason, 300));
    return { ok: true };
  } },

  { method: "POST", pattern: "supply", handler: async (req, _p, m) => {
    const u = await requireApi();
    rateLimit(`supply:${u.id}`, 10, 60_000);
    const b = await body(req);
    const method = ["part_number", "vehicle", "vin", "image"].includes(String(b.method)) ? String(b.method) : "part_number";
    const partNumber = str(b.partNumber, 80), partName = str(b.partName, 150), vin = str(b.vin, 14).replace(/\D/g, "");
    if (method === "part_number" && !partNumber) throw new HttpError(400, "کد محصول الزامی است");
    if (method === "vehicle" && (!partName || !str(b.carMake))) throw new HttpError(400, "نام محصول و برند / تولیدکننده الزامی است");
    if (method === "vin" && !/^\d{8,14}$/.test(vin)) throw new HttpError(400, "بارکد باید ۸ تا ۱۴ رقم باشد");
    const mediaIds = Array.isArray(b.mediaIds) ? (b.mediaIds as unknown[]).map((x) => int(x, 1)).slice(0, 5) : [];
    if (method === "image" && !mediaIds.length) throw new HttpError(400, "حداقل یک تصویر الزامی است");
    if (mediaIds.length) {
      const own = await db.select({ id: media.id }).from(media).where(and(inArray(media.id, mediaIds), eq(media.uploadedBy, u.id)));
      if (own.length !== mediaIds.length) throw new HttpError(403, "تصویر نامعتبر");
    }
    const r = await db.transaction(async (tx) => {
      const [r] = await tx.insert(supplyRequests).values({
        number: genNumber("RQ"), customerId: u.id, method, partNumber, normalizedPn: normalizePn(partNumber), partName,
        carMake: str(b.carMake, 60), carModel: str(b.carModel, 60), carYear: str(b.carYear, 10), vin: vin || null,
        qty: int(b.qty ?? 1, 1, 500), description: str(b.description, 2000), mediaIds, priority: ["low", "normal", "high", "urgent"].includes(String(b.priority)) ? String(b.priority) : "normal",
      }).returning();
      await audit(tx, { userId: u.id, ...m }, "supply.create", "supply_request", r.id, null, { number: r.number, partNumber });
      return r;
    });
    return { id: r.id, number: r.number };
  } },
  { method: "POST", pattern: "supply/:id/customer", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const action = String(b.action);
    if (!["approve", "cancel"].includes(action)) throw new HttpError(400, "عملیات نامعتبر — پرداخت فقط از طریق درگاه انجام می‌شود");
    await customerSupplyAction({ userId: u.id, ...m }, idParam(p.id), action as "approve", b.idempotencyKey ? `spay:${u.id}:${str(b.idempotencyKey, 100)}` : undefined);
    return { ok: true };
  } },

  { method: "POST", pattern: "tickets", handler: async (req, _p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const subject = str(b.subject, 200), text = str(b.body, 5000);
    if (!subject || !text) throw new HttpError(400, "موضوع و متن الزامی است");
    const [dep] = await db.select().from(ticketDepartments).where(and(eq(ticketDepartments.key, str(b.department, 40)), eq(ticketDepartments.isActive, true)));
    if (!dep) throw new HttpError(400, "دپارتمان را انتخاب کنید");
    const t = await db.transaction(async (tx) => {
      const [t] = await tx.insert(tickets).values({
        number: genNumber("TK"), customerId: u.id, subject, department: dep.key,
        priority: ["low", "normal", "high", "urgent"].includes(String(b.priority)) ? String(b.priority) : "normal", orderId: b.orderId ? int(b.orderId, 1) : null, productId: b.productId ? int(b.productId, 1) : null,
      }).returning();
      await tx.insert(ticketMessages).values({ ticketId: t.id, userId: u.id, body: text });
      await audit(tx, { userId: u.id, ...m }, "ticket.create", "ticket", t.id);
      return t;
    });
    return { id: t.id };
  } },
  { method: "POST", pattern: "tickets/:id/messages", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const id = idParam(p.id);
    const text = str(b.body, 5000);
    if (!text) throw new HttpError(400, "متن پیام خالی است");
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
    const staff = u.permissions.includes("TICKETS_MANAGE");
    if (!t || (!staff && t.customerId !== u.id)) throw new HttpError(404, "تیکت یافت نشد");
    if (t.status === "closed") throw new HttpError(400, "تیکت بسته است");
    const isInternal = staff && b.isInternal === true;
    await db.insert(ticketMessages).values({ ticketId: id, userId: u.id, body: text, isInternal, mediaId: b.mediaId ? int(b.mediaId, 1) : null });
    if (!isInternal) await db.update(tickets).set({ status: staff ? "pending_customer" : "pending_staff", updatedAt: new Date() }).where(eq(tickets.id, id));
    await audit(db, { userId: u.id, ...m }, "ticket.message", "ticket", id, null, { isInternal });
    if (staff && !isInternal) {
      const [c] = await db.select().from(users).where(eq(users.id, t.customerId));
      await db.insert(notifications).values({ userId: t.customerId, title: `پاسخ به تیکت ${t.number}`, link: `/customer/tickets/${t.id}` });
      if (c) void sendSms("ticket_reply", c.phone, { ticket: t.number });
    }
    return { ok: true };
  } },
  { method: "POST", pattern: "notifications/read", handler: async () => {
    const u = await requireApi();
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, u.id));
    return { ok: true };
  } },
  { method: "GET", pattern: "admin/integrity", handler: async () => {
    await requireApi("AUDIT_LOG_VIEW");
    const r = await db.execute(sql`
      select
        (select coalesce(sum(debit),0) from journal_lines) as debit,
        (select coalesce(sum(credit),0) from journal_lines) as credit,
        (select count(*) from (select entry_id from journal_lines group by entry_id having sum(debit) <> sum(credit)) x) as unbalanced_entries,
        (select count(*) from seller_offers where reserved > stock or reserved < 0) as bad_offers,
        (select count(*) from products where (reserved > on_hand and allow_backorder = false) or reserved < 0) as bad_products,
        (select count(*) from wallets where pending_balance < 0 or available_balance < 0 or locked_balance < 0) as bad_wallets,
        (select count(*) from audit_logs) as audit_count`);
    const row = r.rows[0] as Record<string, string>;
    const pass = row.debit === row.credit && Number(row.unbalanced_entries) === 0 && Number(row.bad_offers) === 0 && Number(row.bad_products) === 0 && Number(row.bad_wallets) === 0;
    return { pass, ...row, checkedAt: new Date().toISOString(), lastAudit: (await db.select().from(auditLogs).orderBy(sql`id desc`).limit(1))[0]?.action };
  } },
];
