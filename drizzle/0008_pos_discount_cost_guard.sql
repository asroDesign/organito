ALTER TABLE seller_offers ADD COLUMN IF NOT EXISTS cost_price bigint NOT NULL DEFAULT 0;
UPDATE seller_offers
SET cost_price = LEAST(price, COALESCE(sale_price, price))
WHERE cost_price = 0;

ALTER TABLE seller_pos_items ADD COLUMN IF NOT EXISTS unit_cost bigint NOT NULL DEFAULT 0;
