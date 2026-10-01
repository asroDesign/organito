import { createHash, randomInt, timingSafeEqual } from "crypto";
import { and, desc, eq, gt, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, media, orderItems, orders, otpCodes, productAnswers, productQuestions, products, reviews, reviewVotes, sellerOffers, sellers, settings, users, wallets, detailAccounts } from "@/db/schema";
import { createSession, hashPassword, rateLimit, requireApi } from "../auth";
import { audit, notify } from "../audit";
import { getSettings } from "../settings";
import { sendSms } from "../sms";
import { listShopProducts } from "../queries";
import { HttpError, int, normalizePn, str } from "../util";
import { body, idParam, type Route } from "./router";

const lines = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split("\n")).map((x) => str(x, 120)).filter(Boolean).slice(0, 8);
const pepper = () => process.env.OTP_SECRET || process.env.DATABASE_URL || "otp";
const hashOtp = (phone: string, code: string) => createHash("sha256").update(`${pepper()}:${phone}:${code}`).digest("hex");
const normalizePhone = (value: unknown) => str(value, 30)
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/\D/g, "").replace(/^0098/, "0").replace(/^98/, "0").replace(/^9/, "09");
const smsConfigured = async () => { const s = await getSettings(); return !!s.smsApiKey || (s.smsProvider === "kavenegar" ? !!process.env.KAVENEGAR_API_KEY : !!process.env.SMSIR_API_KEY); };

async function assertProduct(id: number) {
  const [p] = await db.select({ id: products.id, nameFa: products.nameFa, status: products.status, ownerSellerId: products.ownerSellerId, slug: products.slug }).from(products).where(eq(products.id, id));
  if (!p || !["active", "out_of_stock"].includes(p.status)) throw new HttpError(404, "محصول یافت نشد");
  return p;
}

export const communityRoutes: Route[] = [
  // ---------------- reviews ----------------
  { method: "POST", pattern: "products/:id/reviews", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`review:${u.id}`, 5, 60 * 60_000);
    const pr = await assertProduct(idParam(p.id));
    const b = await body(req);
    const rating = int(b.rating, 1, 5);
    const text = str(b.body, 3000);
    if (text.length < 10) throw new HttpError(400, "متن نظر حداقل ۱۰ کاراکتر باشد");
    const mediaIds = Array.isArray(b.mediaIds) ? (b.mediaIds as unknown[]).map((x) => int(x, 1)).slice(0, 5) : [];
    if (mediaIds.length) {
      const own = await db.select({ id: media.id, mime: media.mime }).from(media).where(and(inArray(media.id, mediaIds), eq(media.uploadedBy, u.id)));
      if (own.length !== new Set(mediaIds).size || own.some((x) => !x.mime.startsWith("image/"))) throw new HttpError(403, "تصاویر نامعتبر");
    }
    const [bought] = await db.select({ id: orderItems.id }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.productId, pr.id), eq(orders.customerId, u.id), eq(orders.paymentStatus, "paid"))).limit(1);
    const s = await getSettings();
    const status = s.reviewAutoApprove ? "approved" : "pending";
    const [exists] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, u.id), eq(reviews.productId, pr.id)));
    if (exists) throw new HttpError(409, "شما قبلاً برای این محصول نظر ثبت کرده‌اید");
    const [r] = await db.insert(reviews).values({ productId: pr.id, userId: u.id, rating, title: str(b.title, 120) || null, body: text, pros: lines(b.pros), cons: lines(b.cons), mediaIds, recommend: b.recommend === true ? true : b.recommend === false ? false : null, verifiedPurchase: !!bought, status }).returning();
    if (status === "approved" && mediaIds.length) await db.update(media).set({ isPublic: true }).where(inArray(media.id, mediaIds));
    await audit(db, { userId: u.id, ...m }, "review.create", "review", r.id, null, { productId: pr.id, rating });
    return { id: r.id, status };
  } },
  { method: "POST", pattern: "reviews/:id/vote", handler: async (req, p) => {
    const u = await requireApi();
    const id = idParam(p.id);
    const up = (await body(req)).up === true;
    return db.transaction(async (tx) => {
      const [r] = await tx.select().from(reviews).where(eq(reviews.id, id)).for("update");
      if (!r || r.status !== "approved") throw new HttpError(404, "نظر یافت نشد");
      if (r.userId === u.id) throw new HttpError(400, "به نظر خودتان نمی‌توانید رأی دهید");
      const [old] = await tx.select().from(reviewVotes).where(and(eq(reviewVotes.reviewId, id), eq(reviewVotes.userId, u.id)));
      if (old?.up === up) return { helpful: r.helpful, notHelpful: r.notHelpful };
      if (old) await tx.update(reviewVotes).set({ up }).where(eq(reviewVotes.id, old.id));
      else await tx.insert(reviewVotes).values({ reviewId: id, userId: u.id, up });
      const helpful = r.helpful + (up ? 1 : 0) - (old && old.up ? 1 : 0);
      const notHelpful = r.notHelpful + (!up ? 1 : 0) - (old && !old.up ? 1 : 0);
      await tx.update(reviews).set({ helpful, notHelpful }).where(eq(reviews.id, id));
      return { helpful, notHelpful };
    });
  } },
  { method: "POST", pattern: "admin/reviews/:id", handler: async (req, p, m) => {
    const u = await requireApi("PRODUCTS_APPROVE");
    const id = idParam(p.id);
    const b = await body(req);
    const [r] = await db.select().from(reviews).where(eq(reviews.id, id));
    if (!r) throw new HttpError(404, "یافت نشد");
    const status = ["approved", "rejected", "pending"].includes(String(b.status)) ? String(b.status) : r.status;
    const adminReply = b.adminReply !== undefined ? str(b.adminReply, 1000) || null : r.adminReply;
    await db.update(reviews).set({ status, adminReply }).where(eq(reviews.id, id));
    if (r.mediaIds.length) await db.update(media).set({ isPublic: status === "approved" }).where(inArray(media.id, r.mediaIds));
    if (status !== r.status && status !== "pending") await notify(db, r.userId, status === "approved" ? "نظر شما منتشر شد" : "نظر شما تأیید نشد", undefined, undefined);
    await audit(db, { userId: u.id, ...m }, "review.moderate", "review", id, { status: r.status }, { status, adminReply: !!adminReply });
    return { ok: true };
  } },

  // ---------------- questions & answers ----------------
  { method: "POST", pattern: "products/:id/questions", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`question:${u.id}`, 10, 60 * 60_000);
    const pr = await assertProduct(idParam(p.id));
    const text = str((await body(req)).body, 1000);
    if (text.length < 5) throw new HttpError(400, "متن پرسش خیلی کوتاه است");
    const s = await getSettings();
    const [q] = await db.insert(productQuestions).values({ productId: pr.id, userId: u.id, body: text, status: s.reviewAutoApprove || u.staff ? "approved" : "pending" }).returning();
    if (pr.ownerSellerId) { const [sl] = await db.select().from(sellers).where(eq(sellers.id, pr.ownerSellerId)); if (sl) await notify(db, sl.userId, `پرسش جدید درباره «${pr.nameFa}»`, text.slice(0, 120), `/products/${pr.slug}#qa`); }
    await audit(db, { userId: u.id, ...m }, "question.create", "product_question", q.id, null, { productId: pr.id });
    return { id: q.id, status: q.status };
  } },
  { method: "POST", pattern: "questions/:id/answers", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`answer:${u.id}`, 20, 60 * 60_000);
    const qid = idParam(p.id);
    const text = str((await body(req)).body, 2000);
    if (text.length < 2) throw new HttpError(400, "متن پاسخ خالی است");
    const [q] = await db.select().from(productQuestions).where(eq(productQuestions.id, qid));
    if (!q || q.status !== "approved") throw new HttpError(404, "پرسش یافت نشد");
    let role = "customer";
    if (u.staff) role = "staff";
    else if (u.sellerId) {
      const [pr] = await db.select({ owner: products.ownerSellerId }).from(products).where(eq(products.id, q.productId));
      const [of] = await db.select({ id: sellerOffers.id }).from(sellerOffers).where(and(eq(sellerOffers.productId, q.productId), eq(sellerOffers.sellerId, u.sellerId)));
      if (pr?.owner === u.sellerId || of) role = "seller";
    }
    const status = role === "staff" ? "approved" : "pending";
    const [a] = await db.insert(productAnswers).values({ questionId: qid, userId: u.id, body: text, role, status }).returning();
    if (status === "approved" && q.userId !== u.id) await notify(db, q.userId, "به پرسش شما پاسخ داده شد", text.slice(0, 120), undefined);
    await audit(db, { userId: u.id, ...m }, "answer.create", "product_answer", a.id, null, { questionId: qid, role });
    return { id: a.id, status };
  } },
  { method: "POST", pattern: "admin/questions/:id", handler: async (req, p, m) => {
    const u = await requireApi("PRODUCTS_APPROVE");
    const id = idParam(p.id);
    const status = String((await body(req)).status);
    if (!["approved", "rejected"].includes(status)) throw new HttpError(400, "وضعیت نامعتبر");
    await db.update(productQuestions).set({ status }).where(eq(productQuestions.id, id));
    await audit(db, { userId: u.id, ...m }, "question.moderate", "product_question", id, null, { status });
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/answers/:id", handler: async (req, p, m) => {
    const u = await requireApi("PRODUCTS_APPROVE");
    const id = idParam(p.id);
    const status = String((await body(req)).status);
    if (!["approved", "rejected"].includes(status)) throw new HttpError(400, "وضعیت نامعتبر");
    const [a] = await db.select().from(productAnswers).where(eq(productAnswers.id, id));
    if (!a) throw new HttpError(404, "یافت نشد");
    await db.update(productAnswers).set({ status }).where(eq(productAnswers.id, id));
    if (status === "approved" && a.status !== "approved") {
      const [q] = await db.select().from(productQuestions).where(eq(productQuestions.id, a.questionId));
      if (q && q.userId !== a.userId) await notify(db, q.userId, "به پرسش شما پاسخ داده شد", a.body.slice(0, 120), undefined);
    }
    await audit(db, { userId: u.id, ...m }, "answer.moderate", "product_answer", id, { status: a.status }, { status });
    return { ok: true };
  } },

  // ---------------- AJAX search ----------------
  { method: "GET", pattern: "search", handler: async (req, _p, m) => {
    rateLimit(`search:${m.ip}`, 60, 60_000);
    const q = str(req.nextUrl.searchParams.get("q"), 60);
    if (q.length < 2) return { products: [], categories: [], brands: [] };
    const like = `%${q}%`;
    const [items, cats, brands] = await Promise.all([
      listShopProducts({ q }, 40),
      db.select({ id: categories.id, name: categories.name }).from(categories).where(ilike(categories.name, like)).limit(5),
      db.selectDistinct({ brand: products.brand }).from(products).where(and(ilike(products.brand, like), inArray(products.status, ["active", "out_of_stock"]))).limit(5),
    ]);
    const pn = normalizePn(q);
    const rank = (p: (typeof items)[number]) => (p.nameFa.startsWith(q) ? 0 : p.nameFa.includes(q) ? 1 : pn && p.partNumber && normalizePn(p.partNumber).includes(pn) ? 2 : 3) * 10 - (p.inStock ? 1 : 0);
    const sorted = [...items].sort((a, b) => rank(a) - rank(b)).slice(0, 8);
    return {
      total: items.length,
      products: sorted.map((p) => ({ id: p.id, slug: p.slug, name: p.nameFa, brand: p.brand, imageId: p.imageId, price: p.minPrice, compareAt: p.compareAt, inStock: p.inStock, category: p.category, discountPct: p.discountPct })),
      categories: cats, brands: brands.map((b) => b.brand),
    };
  } },

  // ---------------- OTP auth ----------------
  { method: "POST", pattern: "auth/otp/request", handler: async (req, _p, m) => {
    const b = await body(req);
    const phone = normalizePhone(b.phone);
    if (!/^09\d{9}$/.test(phone)) throw new HttpError(400, "شماره موبایل معتبر وارد کنید (مثلاً 09121234567)");
    rateLimit(`otpip:${m.ip}`, 10, 10 * 60_000);
    rateLimit(`otpph:${phone}`, 4, 10 * 60_000);
    const [last] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone)).orderBy(desc(otpCodes.id)).limit(1);
    if (last && Date.now() - last.createdAt.getTime() < 60_000) throw new HttpError(429, "برای دریافت مجدد کد، یک دقیقه صبر کنید");
    const code = String(randomInt(10000, 100000));
    await db.update(otpCodes).set({ used: true }).where(and(eq(otpCodes.phone, phone), eq(otpCodes.used, false)));
    await db.insert(otpCodes).values({ phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + 120_000), ip: m.ip });
    const [u] = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.phone, phone));
    if (u && !u.isActive) throw new HttpError(403, "حساب کاربری شما غیرفعال است");
    const configured = await smsConfigured();
    await sendSms("otp_login", phone, { code }, true);
    const s = await getSettings();
    return { ok: true, isNew: !u, ttl: 120, canSellerSignup: b.sellerIntent === true && !!(s.multiVendor && s.allowSellerSignup), ...(configured ? {} : { devCode: code, devNote: "سرویس پیامک تنظیم نشده؛ کد برای آزمایش نمایش داده می‌شود." }) };
  } },
  { method: "POST", pattern: "auth/otp/verify", handler: async (req, _p, m) => {
    const b = await body(req);
    const phone = normalizePhone(b.phone);
    const code = str(b.code, 6).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
    if (!/^09\d{9}$/.test(phone) || !/^\d{5}$/.test(code)) throw new HttpError(400, "کد تأیید ۵ رقمی را وارد کنید");
    rateLimit(`otpv:${phone}`, 10, 10 * 60_000);
    const [otp] = await db.select().from(otpCodes).where(and(eq(otpCodes.phone, phone), eq(otpCodes.used, false), gt(otpCodes.expiresAt, new Date()))).orderBy(desc(otpCodes.id)).limit(1);
    if (!otp) throw new HttpError(400, "کد منقضی شده است؛ دوباره درخواست کنید");
    if (otp.attempts >= 5) { await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otp.id)); throw new HttpError(429, "تعداد تلاش‌ها بیش از حد مجاز؛ کد جدید دریافت کنید"); }
    const a = Buffer.from(otp.codeHash, "hex"), c = Buffer.from(hashOtp(phone, code), "hex");
    if (a.length !== c.length || !timingSafeEqual(a, c)) {
      await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
      throw new HttpError(400, `کد وارد شده صحیح نیست (${(4 - otp.attempts).toLocaleString("fa-IR")} تلاش باقی مانده)`);
    }
    let [u] = await db.select().from(users).where(eq(users.phone, phone));
    const s = await getSettings();
    if (!u) {
      const name = str(b.name, 100);
      if (name.length < 2) throw new HttpError(400, "برای ثبت‌نام نام و نام خانوادگی را وارد کنید");
      const asSeller = b.asSeller === true && b.sellerIntent === true && !!s.multiVendor && !!s.allowSellerSignup;
      const referralCode = str(b.referralCode, 32).trim().toUpperCase();
      u = await db.transaction(async (tx) => {
        const [referrer] = referralCode ? await tx.select({ id: users.id }).from(users).where(eq(users.referralCode, referralCode)).limit(1) : [];
        const [nu] = await tx.insert(users).values({ name, phone, passwordHash: hashPassword(`${Date.now()}${Math.random()}`), role: asSeller ? "seller" : "customer", referredById: !asSeller && referrer?.id ? referrer.id : null, referralCode: `SBZ${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,6).toUpperCase()}` }).returning();
        if (asSeller) {
          const [sl] = await tx.insert(sellers).values({ userId: nu.id, shopName: str(b.shopName, 100) || name, city: str(b.city, 50) || "تهران", status: "pending", commissionRate: s.defaultCommission }).returning();
          await tx.insert(wallets).values({ sellerId: sl.id });
          const [parent] = await tx.select().from(detailAccounts).where(eq(detailAccounts.code, "S"));
          await tx.insert(detailAccounts).values({ code: `S-${sl.id}`, name: sl.shopName, level: 3, parentId: parent?.id ?? null });
        }
        await audit(tx, { userId: nu.id, ...m }, "auth.register_otp", "user", nu.id, null, { role: nu.role });
        return nu;
      });
    }
    if (!u.isActive) throw new HttpError(403, "حساب کاربری شما غیرفعال است");
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otp.id));
    await createSession(u.id, m.ip, m.ua);
    await audit(db, { userId: u.id, ...m }, "auth.login_otp", "user", u.id);
    const [sl] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.userId, u.id));
    return { ok: true, redirect: u.role === "customer" ? "/customer" : sl ? "/seller" : "/admin" };
  } },

  // ---------------- hero & multi-vendor settings ----------------
  { method: "POST", pattern: "admin/hero", handler: async (req, _p, m) => {
    const u = await requireApi("SETTINGS_MANAGE");
    const b = await body(req);
    const heroMediaId = b.heroMediaId ? int(b.heroMediaId, 1) : 0;
    let heroType = "image";
    if (heroMediaId) {
      const [mm] = await db.select({ mime: media.mime }).from(media).where(eq(media.id, heroMediaId));
      if (!mm) throw new HttpError(400, "رسانه نامعتبر");
      heroType = mm.mime.startsWith("video/") ? "video" : mm.mime === "image/gif" ? "gif" : "image";
      await db.update(media).set({ isPublic: true }).where(eq(media.id, heroMediaId));
    }
    const vals: Record<string, unknown> = { heroMediaId, heroType, heroTitle: str(b.heroTitle, 150), heroSubtitle: str(b.heroSubtitle, 400) };
    for (const [key, value] of Object.entries(vals)) await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    await audit(db, { userId: u.id, ...m }, "settings.hero", "settings", null, null, vals);
    return { ok: true, heroType };
  } },
];
