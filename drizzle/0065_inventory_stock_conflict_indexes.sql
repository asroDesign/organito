-- Stable arbiter indexes for the central-stock sync triggers and branch inventory writes.
-- Distinct names also repair installations where a legacy index with a reused name
-- had a different definition and IF NOT EXISTS silently skipped the correct index.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_stock_product_pair_uq
  ON inventory_warehouse_stock(warehouse_id,product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_stock_variant_pair_uq
  ON inventory_warehouse_stock(warehouse_id,variant_id) WHERE variant_id IS NOT NULL;
