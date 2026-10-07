import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { Calculator } from "lucide-react";
import { db } from "@/db";
import { fxProductPrices, fxRates, productVariants, products } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { FxPricingManager } from "@/components/FxPricingManager";
import { getSettings } from "@/lib/settings";

export default async function FxPricingPage() {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const [rateRows, productRows, variantRows, ruleRows, settings] = await Promise.all([
    db.select().from(fxRates).orderBy(asc(fxRates.currencyCode)),
    db.select().from(products).where(and(eq(products.source, "central"), ne(products.status, "deleted"))).orderBy(asc(products.nameFa)),
    db.select({ variant: productVariants, product: products }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(products.source, "central"), ne(products.status, "deleted"), eq(productVariants.isActive, true), isNull(productVariants.deletedAt))).orderBy(asc(products.nameFa), asc(productVariants.title)),
    db.select({ config: fxProductPrices }).from(fxProductPrices).orderBy(asc(fxProductPrices.targetKey)),
    getSettings(),
  ]);
  const activeVariantProducts = new Set(variantRows.map(({ product }) => product.id));
  const targets = [
    ...productRows.filter((product) => !activeVariantProducts.has(product.id)).map((product) => ({ targetKey: `p:${product.id}`, productId: product.id, variantId: null, label: product.nameFa, sku: product.sku, currentPrice: product.basePrice, cost: product.avgCost })),
    ...variantRows.map(({ product, variant }) => ({ targetKey: `v:${variant.id}`, productId: product.id, variantId: variant.id, label: `${product.nameFa} · ${variant.title}`, sku: variant.sku, currentPrice: variant.price ?? product.basePrice, cost: variant.costPrice ?? product.avgCost })),
  ];
  const initialRules = ruleRows.map(({ config }) => ({ targetKey: config.targetKey, currencyCode: config.currencyCode, foreignAmount: config.foreignAmount / 10_000, markupPercent: config.markupPercent, roundingStep: config.roundingStep, sourceNote: config.sourceNote, lastAppliedRate: config.lastAppliedRate, lastAppliedAt: config.lastAppliedAt }));
  return <>
    <PageHeader title="قیمت‌گذاری با نرخ ارز" subtitle="نرخ‌های ثبت‌شده، مبنای ارزی هر محصول و پیش‌نمایش امن تغییر قیمت‌ها" />
    <FeatureIntro className="my-5" icon={Calculator} title="قیمت‌ها فقط با تأیید شما اعمال می‌شوند" tone="yellow" text="نرخ و مبنای ارزی را ثبت کنید؛ ابزار ابتدا تغییرات را محاسبه می‌کند و قیمت زیر بهای خرید را مسدود می‌سازد. ثبت نرخ یا قاعده به‌تنهایی قیمت فروش را تغییر نمی‌دهد." />
    <FxPricingManager initialRates={rateRows} targets={targets} initialRules={initialRules} currencyUnit={settings.currency} />
  </>;
}
