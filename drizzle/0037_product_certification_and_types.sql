ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS certified_organic boolean NOT NULL DEFAULT false;
