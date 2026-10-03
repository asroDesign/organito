ALTER TABLE central_pos_sales
  ADD COLUMN IF NOT EXISTS shipping_carrier_id integer,
  ADD COLUMN IF NOT EXISTS shipping_carrier_name text,
  ADD COLUMN IF NOT EXISTS shipping_cost bigint NOT NULL DEFAULT 0;
