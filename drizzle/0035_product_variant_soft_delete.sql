ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
