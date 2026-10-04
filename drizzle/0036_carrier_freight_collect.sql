ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS supports_freight_collect boolean NOT NULL DEFAULT false;

ALTER TABLE seller_shipments
  ADD COLUMN IF NOT EXISTS freight_collect boolean NOT NULL DEFAULT false;

ALTER TABLE central_pos_sales
  ADD COLUMN IF NOT EXISTS shipping_freight_collect boolean NOT NULL DEFAULT false;
