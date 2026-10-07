import type { QuantityPriceTier } from "@/db/schema";

export function applicableQuantityTier(tiers: QuantityPriceTier[] | null | undefined, quantity: number) {
  return (tiers ?? []).find((tier) => quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) ?? null;
}

export function quantityTierPrice(price: number, tier: QuantityPriceTier | null | undefined) {
  if (!tier) return price;
  const discount = tier.discountType === "percent" ? Math.round(price * tier.discountValue / 100) : tier.discountValue;
  return Math.max(0, price - discount);
}
