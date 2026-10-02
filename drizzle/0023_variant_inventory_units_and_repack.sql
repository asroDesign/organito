-- Inventory quantities and conversions are stored per product variant.
-- Existing inventory is preserved; new fields receive neutral defaults.
ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_base_unit text NOT NULL DEFAULT 'عدد';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS inventory_unit text NOT NULL DEFAULT 'عدد';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS base_unit_amount integer NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS is_sellable boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS inventory_repack_jobs (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  source_variant_id integer NOT NULL,
  target_variant_id integer NOT NULL,
  input_qty integer NOT NULL,
  output_qty integer NOT NULL,
  note text,
  user_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_repack_product_created ON inventory_repack_jobs(product_id, created_at);
