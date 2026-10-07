import { createHash } from "node:crypto";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { audit } from "@/lib/audit";
import { requireApi } from "@/lib/auth";
import { HttpError, int, str } from "@/lib/util";
import { fxProductPrices, fxRates, productPriceHistory, productVariants, products } from "@/db/schema";
import type { DB } from "@/lib/types";
import { body, type Route } from "./router";

const AMOUNT_SCALE = 10_000;
const moneyLimit = 1_000_000_000_000;
const safeCode = (value: unknown) => str(value, 10).toUpperCase();

function decimalScaled(value: unknown) {
  const raw = str(value, 40).replace(/[٬,\s]/g, "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) throw new HttpError(400, "مبلغ ارزی باید عددی مثبت و حداکثر ۱۰۰ میلیون باشد");
  return Math.round(amount * AMOUNT_SCALE);
}

type PreviewLine = {
  targetKey: string; productId: number; variantId: number | null; productName: string; sku: string; variantTitle: string | null;
  currencyCode: string; currencyName: string; rateValue: number; rateSource: string; rateUpdatedAt: Date | null; foreignAmount: number; markupPercent: number;
  roundingStep: number; currentPrice: number; currentReferencePrice: number; newPrice: number | null; newReferencePrice: number | null;
  cost: number; status: "ready" | "blocked"; reason: string | null;
};

async function calculatePreview(executor: DB, targetKeys: string[]): Promise<PreviewLine[]> {
  if (!targetKeys.length) return [];
  const rows = await executor.select({ config: fxProductPrices, product: products, variant: productVariants, rate: fxRates })
    .from(fxProductPrices)
    .innerJoin(products, eq(products.id, fxProductPrices.productId))
    .leftJoin(productVariants, eq(productVariants.id, fxProductPrices.variantId))
    .leftJoin(fxRates, eq(fxRates.currencyCode, fxProductPrices.currencyCode))
    .where(and(inArray(fxProductPrices.targetKey, targetKeys), eq(products.source, "central"), ne(products.status, "deleted")))
    .orderBy(asc(fxProductPrices.targetKey));
  return rows.map(({ config, product, variant, rate }) => {
    const currentPrice = config.variantId ? (variant?.price ?? 0) : product.basePrice;
    const currentReferencePrice = config.variantId ? (variant?.compareAtPrice ?? 0) : product.compareAtPrice;
    const cost = config.variantId ? (variant?.costPrice ?? product.avgCost) : product.avgCost;
    const issues: string[] = [];
    if (config.variantId && (!variant || variant.deletedAt || !variant.isActive || variant.productId !== product.id)) issues.push("تنوع حذف‌شده یا غیرفعال است");
    if (!rate) issues.push("نرخ این ارز ثبت نشده است");
    let newPrice: number | null = null, newReferencePrice: number | null = null;
    if (rate && !issues.length) {
      const rawPrice = config.foreignAmount / AMOUNT_SCALE * rate.rateValue * (1 + config.markupPercent / 100);
      const rounded = Math.ceil(rawPrice / config.roundingStep) * config.roundingStep;
      if (!Number.isSafeInteger(rounded) || rounded < 1 || rounded > moneyLimit) issues.push("قیمت محاسبه‌شده از بازه مجاز فروشگاه خارج است");
      else {
        newPrice = rounded;
        if (currentReferencePrice > currentPrice && currentPrice > 0) {
          const reference = Math.ceil(currentReferencePrice * newPrice / currentPrice / config.roundingStep) * config.roundingStep;
          newReferencePrice = Number.isSafeInteger(reference) && reference <= moneyLimit ? reference : null;
          if (newReferencePrice === null) issues.push("قیمت قبل از تخفیف از بازه مجاز خارج است");
        } else newReferencePrice = 0;
        if (newPrice < cost) issues.push(`قیمت پیشنهادی از بهای خرید (${cost.toLocaleString("fa-IR")}) کمتر است`);
      }
    }
    return {
      targetKey: config.targetKey, productId: product.id, variantId: config.variantId, productName: product.nameFa, sku: variant?.sku ?? product.sku,
      variantTitle: config.variantId ? variant?.title ?? "تنوع نامعتبر" : null, currencyCode: config.currencyCode,
      currencyName: rate?.currencyName ?? config.currencyCode, rateValue: Number(rate?.rateValue ?? 0), rateSource: rate?.source ?? "", rateUpdatedAt: rate?.updatedAt ?? null,
      foreignAmount: config.foreignAmount / AMOUNT_SCALE, markupPercent: config.markupPercent, roundingStep: Number(config.roundingStep),
      currentPrice, currentReferencePrice, newPrice, newReferencePrice, cost, status: issues.length ? "blocked" : "ready", reason: issues.join("؛ ") || null,
    };
  });
}

function fingerprint(rows: PreviewLine[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function targetKeys(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new HttpError(400, "بین ۱ تا ۱۰۰ ردیف انتخاب کنید");
  const keys = [...new Set(value.map((key) => str(key, 40)))];
  if (keys.length !== value.length || keys.some((key) => !/^(?:p|v):\d+$/.test(key))) throw new HttpError(400, "فهرست کالاهای انتخاب‌شده معتبر نیست");
  return keys;
}

export const fxPricingRoutes: Route[] = [
  { method: "POST", pattern: "admin/fx-rates", handler: async (req, _params, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), input = await body(req), currencyCode = safeCode(input.currencyCode);
    const currencyName = str(input.currencyName, 40), source = str(input.source, 160), rateValue = int(input.rateValue, 1, moneyLimit);
    if (!/^[A-Z]{3}$/.test(currencyCode) || !currencyName || !source) throw new HttpError(400, "کد سه‌حرفی ارز، نام ارز و منبع نرخ الزامی است");
    await db.transaction(async (tx) => {
      const [old] = await tx.select().from(fxRates).where(eq(fxRates.currencyCode, currencyCode)).for("update");
      const [row] = await tx.insert(fxRates).values({ currencyCode, currencyName, rateValue, source, updatedBy: user.id, updatedAt: new Date() })
        .onConflictDoUpdate({ target: fxRates.currencyCode, set: { currencyName, rateValue, source, updatedBy: user.id, updatedAt: new Date() } }).returning();
      await audit(tx, { userId: user.id, ...meta }, old ? "fx.rate_update" : "fx.rate_create", "fx_rate", currencyCode,
        old ? { currencyName: old.currencyName, rateValue: old.rateValue, source: old.source } : null,
        { currencyName: row.currencyName, rateValue: row.rateValue, source: row.source });
    });
    return { ok: true, currencyCode };
  } },
  { method: "POST", pattern: "admin/fx-product-prices", handler: async (req, _params, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), input = await body(req), productId = int(input.productId, 1);
    const variantId = input.variantId ? int(input.variantId, 1) : null, currencyCode = safeCode(input.currencyCode);
    const foreignAmount = decimalScaled(input.foreignAmount), markupPercent = int(input.markupPercent ?? 0, 0, 500);
    const roundingStep = int(input.roundingStep ?? 1, 1, 1_000_000), sourceNote = str(input.sourceNote, 160) || null;
    if (![1, 10, 100, 1000, 10000, 100000].includes(roundingStep)) throw new HttpError(400, "گام گردکردن باید یکی از ۱، ۱۰، ۱۰۰، ۱٬۰۰۰، ۱۰٬۰۰۰ یا ۱۰۰٬۰۰۰ باشد");
    if (!/^[A-Z]{3}$/.test(currencyCode)) throw new HttpError(400, "کد ارز معتبر نیست");
    const targetKey = `${variantId ? "v" : "p"}:${variantId ?? productId}`;
    await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!product || product.source !== "central" || product.status === "deleted") throw new HttpError(404, "محصول مرکزی پیدا نشد");
      if (variantId) {
        const [variant] = await tx.select().from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))).for("update");
        if (!variant || variant.deletedAt || !variant.isActive) throw new HttpError(404, "تنوع فعال محصول پیدا نشد");
      }
      const [rate] = await tx.select({ currencyCode: fxRates.currencyCode }).from(fxRates).where(eq(fxRates.currencyCode, currencyCode));
      if (!rate) throw new HttpError(400, "ابتدا نرخ ارز را در همین صفحه ثبت کنید");
      const [old] = await tx.select().from(fxProductPrices).where(eq(fxProductPrices.targetKey, targetKey)).for("update");
      const values = { targetKey, productId, variantId, currencyCode, foreignAmount, markupPercent, roundingStep, sourceNote, updatedBy: user.id, updatedAt: new Date() };
      const [saved] = await tx.insert(fxProductPrices).values(values).onConflictDoUpdate({ target: fxProductPrices.targetKey, set: values }).returning();
      await audit(tx, { userId: user.id, ...meta }, old ? "fx.product_rule_update" : "fx.product_rule_create", "fx_product_price", saved.id,
        old ? { currencyCode: old.currencyCode, foreignAmount: old.foreignAmount, markupPercent: old.markupPercent, roundingStep: old.roundingStep } : null,
        { currencyCode, foreignAmount, markupPercent, roundingStep, sourceNote, productId, variantId });
    });
    return { ok: true, targetKey };
  } },
  { method: "POST", pattern: "admin/fx-pricing/preview", handler: async (req) => {
    await requireApi("PRODUCTS_EDIT");
    const keys = targetKeys((await body(req)).targetKeys), rows = await calculatePreview(db, keys);
    if (rows.length !== keys.length) throw new HttpError(404, "یکی از قواعد قیمت‌گذاری پیدا نشد");
    return { rows, fingerprint: fingerprint(rows) };
  } },
  { method: "POST", pattern: "admin/fx-pricing/apply", handler: async (req, _params, meta) => {
    const user = await requireApi("PRODUCTS_EDIT"), input = await body(req), keys = targetKeys(input.targetKeys), expected = str(input.fingerprint, 64);
    if (input.confirm !== true || !/^[a-f0-9]{64}$/.test(expected)) throw new HttpError(400, "پیش‌نمایش و تأیید صریح اعمال قیمت‌ها الزامی است");
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(99128)`);
      const configs = await tx.select().from(fxProductPrices).where(inArray(fxProductPrices.targetKey, keys)).for("update");
      if (configs.length !== keys.length) throw new HttpError(409, "یکی از قواعد قیمت‌گذاری حذف شده است؛ پیش‌نمایش را دوباره بسازید");
      await tx.select({ id: products.id }).from(products).where(inArray(products.id, [...new Set(configs.map((row) => row.productId))])).for("update");
      const variantIds = configs.flatMap((row) => row.variantId ? [row.variantId] : []);
      if (variantIds.length) await tx.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.id, variantIds)).for("update");
      const currencyCodes = [...new Set(configs.map((row) => row.currencyCode))];
      if (currencyCodes.length) await tx.select({ currencyCode: fxRates.currencyCode }).from(fxRates).where(inArray(fxRates.currencyCode, currencyCodes)).for("update");
      const rows = await calculatePreview(tx, keys);
      if (rows.length !== keys.length) throw new HttpError(409, "فهرست قواعد تغییر کرده است؛ پیش‌نمایش را دوباره بسازید");
      if (fingerprint(rows) !== expected) throw new HttpError(409, "نرخ، هزینه خرید یا قیمت محصول پس از پیش‌نمایش تغییر کرده است؛ پیش‌نمایش را تازه کنید");
      const blocked = rows.filter((row) => row.status !== "ready");
      if (blocked.length) throw new HttpError(409, `اعمال متوقف شد؛ ${blocked.length} ردیف نیازمند اصلاح است`);
      for (const row of rows) {
        const before = { price: row.currentPrice, compareAtPrice: row.currentReferencePrice };
        const after = { price: row.newPrice!, compareAtPrice: row.newReferencePrice! };
        if (row.variantId) await tx.update(productVariants).set(after).where(eq(productVariants.id, row.variantId));
        else await tx.update(products).set({ basePrice: after.price, compareAtPrice: after.compareAtPrice, updatedAt: new Date() }).where(eq(products.id, row.productId));
        await tx.insert(productPriceHistory).values({ productId: row.productId, scope: row.variantId ? "variant" : "product", variantId: row.variantId, price: after.price, referencePrice: after.compareAtPrice, source: "fx_batch_update", changedBy: user.id });
        await tx.update(fxProductPrices).set({ lastAppliedRate: row.rateValue, lastAppliedAt: new Date(), updatedBy: user.id, updatedAt: new Date() }).where(eq(fxProductPrices.targetKey, row.targetKey));
        await audit(tx, { userId: user.id, ...meta }, "fx.price_apply", "product", row.productId,
          { ...before, variantId: row.variantId, currencyCode: row.currencyCode },
          { ...after, variantId: row.variantId, currencyCode: row.currencyCode, foreignAmount: row.foreignAmount, rateValue: row.rateValue, rateSource: row.rateSource, markupPercent: row.markupPercent, roundingStep: row.roundingStep });
      }
      return { ok: true, applied: rows.length };
    });
  } },
];
