-- Multi-warehouse stock registry. Legacy stock remains the sellable primary warehouse.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS warehouse_id integer;

CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id serial PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_single_default ON inventory_warehouses(is_default) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS inventory_warehouse_stock (
  id serial PRIMARY KEY,
  warehouse_id integer NOT NULL REFERENCES inventory_warehouses(id),
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer REFERENCES product_variants(id),
  on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_stock_product ON inventory_warehouse_stock(warehouse_id, product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_stock_variant ON inventory_warehouse_stock(warehouse_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_warehouse_stock_lookup ON inventory_warehouse_stock(warehouse_id, product_id);

CREATE TABLE IF NOT EXISTS inventory_warehouse_transfers (
  id serial PRIMARY KEY,
  from_warehouse_id integer NOT NULL REFERENCES inventory_warehouses(id),
  to_warehouse_id integer NOT NULL REFERENCES inventory_warehouses(id),
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  user_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_warehouse_id <> to_warehouse_id)
);
CREATE INDEX IF NOT EXISTS inventory_warehouse_transfer_created ON inventory_warehouse_transfers(created_at DESC);

INSERT INTO inventory_warehouses(name, code, enabled, is_default)
VALUES ('انبار مرکزی', 'MAIN', true, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_warehouse_stock(warehouse_id, product_id, variant_id, on_hand, reserved)
SELECT w.id, p.id, NULL, p.on_hand, p.reserved FROM products p CROSS JOIN inventory_warehouses w
WHERE w.code = 'MAIN' AND p.source = 'central' AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND v.deleted_at IS NULL)
ON CONFLICT (warehouse_id, product_id) WHERE variant_id IS NULL DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = now();

INSERT INTO inventory_warehouse_stock(warehouse_id, product_id, variant_id, on_hand, reserved)
SELECT w.id, v.product_id, v.id, v.on_hand, v.reserved FROM product_variants v
JOIN products p ON p.id = v.product_id CROSS JOIN inventory_warehouses w
WHERE w.code = 'MAIN' AND p.source = 'central'
ON CONFLICT (warehouse_id, variant_id) WHERE variant_id IS NOT NULL DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = now();

CREATE OR REPLACE FUNCTION sync_default_product_warehouse_stock() RETURNS trigger AS $$
BEGIN
  IF NEW.source <> 'central' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = NEW.id AND v.is_active AND v.deleted_at IS NULL) THEN RETURN NEW; END IF;
  INSERT INTO inventory_warehouse_stock(warehouse_id, product_id, variant_id, on_hand, reserved)
  SELECT id, NEW.id, NULL, NEW.on_hand, NEW.reserved FROM inventory_warehouses WHERE is_default = true
  ON CONFLICT (warehouse_id, product_id) WHERE variant_id IS NULL DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_default_variant_warehouse_stock() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.source = 'central') THEN RETURN NEW; END IF;
  INSERT INTO inventory_warehouse_stock(warehouse_id, product_id, variant_id, on_hand, reserved)
  SELECT id, NEW.product_id, NEW.id, NEW.on_hand, NEW.reserved FROM inventory_warehouses WHERE is_default = true
  ON CONFLICT (warehouse_id, variant_id) WHERE variant_id IS NOT NULL DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = EXCLUDED.reserved, updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_sync_default_warehouse ON products;
CREATE TRIGGER products_sync_default_warehouse AFTER INSERT OR UPDATE OF on_hand, reserved ON products FOR EACH ROW EXECUTE FUNCTION sync_default_product_warehouse_stock();
DROP TRIGGER IF EXISTS variants_sync_default_warehouse ON product_variants;
CREATE TRIGGER variants_sync_default_warehouse AFTER INSERT OR UPDATE OF on_hand, reserved ON product_variants FOR EACH ROW EXECUTE FUNCTION sync_default_variant_warehouse_stock();
