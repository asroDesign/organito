-- Add product detail content fields without altering existing product records.
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_image_id integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS related_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cross_sell_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_options jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_faqs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_estimate_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_min_days integer NOT NULL DEFAULT 2;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_max_days integer NOT NULL DEFAULT 5;
