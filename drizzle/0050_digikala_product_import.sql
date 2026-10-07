ALTER TABLE products ADD COLUMN IF NOT EXISTS external_source_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_source_id text;
DROP INDEX IF EXISTS products_external_source_idx;
CREATE UNIQUE INDEX IF NOT EXISTS products_external_source_id_unique ON products (external_source_id);
