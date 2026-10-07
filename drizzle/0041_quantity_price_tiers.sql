-- Quantity-based discounts. JSON keeps the rules local to a product or its exact variant.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quantity_price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS quantity_price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_quantity_price_tiers_array') THEN
    ALTER TABLE products ADD CONSTRAINT products_quantity_price_tiers_array
      CHECK (jsonb_typeof(quantity_price_tiers) = 'array') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_quantity_price_tiers_array') THEN
    ALTER TABLE product_variants ADD CONSTRAINT product_variants_quantity_price_tiers_array
      CHECK (jsonb_typeof(quantity_price_tiers) = 'array') NOT VALID;
  END IF;
END $$;

ALTER TABLE products VALIDATE CONSTRAINT products_quantity_price_tiers_array;
ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_quantity_price_tiers_array;
