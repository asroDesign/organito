import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getSettings } from "../settings";
import { db } from "@/db";
import { categories, media, productImages, products, productVariants, sellerOffers, sellers } from "@/db/schema";
import { rateLimit, requireApi } from "../auth";
import { activeFestivals, festivalFor } from "../marketing";
import { payOrder, rejectManualPayment, submitManualPayment, type PayInfo } from "../services/orders";
import { HttpError, int, str } from "../util";
import { body, idParam, type Route } from "./router";

const METHODS = ["gateway", "card_to_card", "bank_transfer", "cash", "pos"] as const;
function parsePay(b: Record<string, unknown>, allowGateway: boolean): PayInfo {
  const method = String(b.method) as PayInfo["method"];
  if (!(METHODS as readonly string[]).includes(method) || (!allowGateway && method === "gateway")) throw new HttpError(400, "روش پرداخت نامعتبر");
  const card = str(b.cardLast4 ?? b.card, 19).replace(/\D/g, "");
  const d = str(b.paidAt, 10);
  if (["card_to_card", "bank_transfer"].includes(method) && !str(b.trackingCode, 60)) throw new HttpError(400, "شماره پیگیری / مرجع تراکنش الزامی است");
  return {
    method, payerName: str(b.payerName, 100) || undefined, bankName: str(b.bankName, 60) || undefined, trackingCode: str(b.trackingCode, 60) || undefined,
    cardMasked: card ? `****-****-****-${card.slice(-4)}` : undefined, note: str(b.note, 500) || undefined,
    paidAt: /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T${/^\d{2}:\d{2}$/.test(str(b.paidTime, 5)) ? str(b.paidTime, 5) : "12:00"}:00+03:30`) : undefined,
    receiptMediaId: b.receiptMediaId ? int(b.receiptMediaId, 1) : null,
    details: { ...(str(b.accountTo, 60) ? { accountTo: str(b.accountTo, 60) } : {}), ...(str(b.chequeNo, 30) ? { chequeNo: str(b.chequeNo, 30) } : {}) },
  };
}

export const paymentRoutes: Route[] = [
  { method: "POST", pattern: "orders/:id/manual-payment", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`mpay:${u.id}`, 5, 60_000);
    const settings = await getSettings();
    if (Number(settings.paymentManualEnabled) !== 1) throw new HttpError(403, "پرداخت کارت‌به‌کارت و حواله بانکی غیرفعال است");
    const b = await body(req);
    const info = parsePay(b, false);
    if (info.receiptMediaId) {
      const [own] = await db.select({ id: media.id }).from(media).where(and(eq(media.id, info.receiptMediaId), eq(media.uploadedBy, u.id)));
      if (!own) throw new HttpError(403, "تصویر فیش نامعتبر");
    }
    const key = str(b.idempotencyKey, 100);
    if (key.length < 8) throw new HttpError(400, "کلید یکتا الزامی است");
    const pay = await submitManualPayment({ userId: u.id, ...m }, idParam(p.id), info, `mp:${u.id}:${key}`);
    return { id: pay.id, status: pay.status };
  } },
  { method: "POST", pattern: "admin/orders/:id/payment", handler: async (req, p, m) => {
    const u = await requireApi("PAYMENTS_MANAGE");
    const b = await body(req);
    const orderId = idParam(p.id);
    const action = String(b.action);
    if (action === "record") {
      await payOrder({ userId: u.id, ...m }, orderId, `adm:${str(b.idempotencyKey, 100) || Date.now()}`, true, parsePay(b, true));
    } else if (action === "verify") {
      await payOrder({ userId: u.id, ...m }, orderId, `ver:${int(b.paymentId, 1)}`, true, { method: "card_to_card", existingPaymentId: int(b.paymentId, 1) });
    } else if (action === "reject") {
      await rejectManualPayment({ userId: u.id, ...m }, int(b.paymentId, 1), str(b.reason, 300) || "عدم تطابق اطلاعات");
    } else throw new HttpError(400, "عملیات نامعتبر");
    return { ok: true };
  } },
  { method: "GET", pattern: "products/:id/quick", handler: async (_r, p) => {
    const id = idParam(p.id);
    const [row] = await db.select({ p: products, cat: categories.name }).from(products).leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.id, id), inArray(products.status, ["active", "out_of_stock"])));
    if (!row) throw new HttpError(404, "محصول یافت نشد");
    const pr = row.p;
    const [images, variants, offers, fests] = await Promise.all([
      db.select({ mediaId: productImages.mediaId }).from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.sortOrder),
      db.select().from(productVariants).where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true), isNull(productVariants.deletedAt))),
      db.select({ o: sellerOffers, s: sellers }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId)).where(and(eq(sellerOffers.productId, id), eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false))),
      activeFestivals(),
    ]);
    const fest = festivalFor(fests, pr.id, pr.categoryId);
    const st = await getSettings();
    const [rv] = (await db.execute(sql`select round(coalesce(avg(rating),0)::numeric,1)::float as avg, count(*)::int as n from reviews where product_id = ${pr.id} and status = 'approved'`)).rows as { avg: number; n: number }[];
    return {
      product: {
        id: pr.id, slug: pr.slug, nameFa: pr.nameFa, nameEn: pr.nameEn, sku: pr.sku, partNumber: pr.partNumber, oemNumber: pr.oemNumber, crossRefs: pr.crossRefs,
        brand: pr.brand, manufacturer: pr.manufacturer, country: pr.country, authenticity: pr.authenticity, certifiedOrganic: pr.certifiedOrganic, category: row.cat, shortDesc: pr.shortDesc,
        technicalReview: pr.technicalReview, specs: pr.specs, compatibility: pr.compatibility, weight: pr.weight, basePrice: pr.basePrice, source: pr.source,
        available: pr.onHand - pr.reserved, allowBackorder: pr.allowBackorder, status: pr.status, options: pr.options, mainImageId: pr.mainImageId,
        organicInfo: pr.organicInfo, videoMediaId: pr.videoMediaId, compareAtPrice: pr.compareAtPrice, purchaseOptions: pr.purchaseOptions,
      },
      rating: rv, store: { multiVendor: !!st.multiVendor, siteName: st.siteName, freeShippingOver: st.freeShippingOver, returnDays: st.returnDays, certificationLabel: st.organicBadgeLabel },
      festival: fest ? { title: fest.title, pct: fest.discountPercent, color: fest.color, endsAt: fest.endsAt.toISOString() } : null,
      images: images.map((i) => i.mediaId),
      variants: variants.map((v) => ({ id: v.id, title: v.title, attrs: v.attrs, price: v.price, compareAtPrice: v.compareAtPrice, available: v.onHand - v.reserved, isSellable: v.isSellable })),
      offers: offers.map(({ o, s }) => ({ id: o.id, sellerId: s.id, shopName: s.shopName, rating: s.rating, city: o.shipCity ?? s.city, price: o.salePrice ?? o.price, listPrice: o.price, available: o.stock - o.reserved, shippingCost: o.shippingCost, prepDays: o.prepDays, warranty: o.warranty, isBuyBox: o.isBuyBox, condition: o.condition }))
        .sort((a, b) => Number(b.isBuyBox) - Number(a.isBuyBox) || a.price - b.price)
        .map((o, i) => (st.multiVendor ? o : { ...o, sellerId: 0, shopName: st.siteName, city: "", rating: 0, isBuyBox: i === 0 })),
    };
  } },
];
