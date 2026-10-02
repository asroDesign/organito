-- Store customer cart snapshots for follow-up. Existing commerce records are untouched.
CREATE TABLE IF NOT EXISTS incomplete_carts (
  id serial PRIMARY KEY,
  cart_key text NOT NULL UNIQUE,
  customer_id integer,
  customer_name text NOT NULL DEFAULT 'مشتری',
  phone text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL DEFAULT 'سبد خرید تکمیل نشده',
  status text NOT NULL DEFAULT 'open',
  last_sms_type text,
  last_sms_status text,
  discount_code_id integer,
  last_sms_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incomplete_carts_status_updated ON incomplete_carts(status, updated_at);
CREATE INDEX IF NOT EXISTS incomplete_carts_customer ON incomplete_carts(customer_id);

-- Keep quick-edit purchase and comparison prices per variation as in the reference workflow.
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS cost_price bigint NOT NULL DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS compare_at_price bigint NOT NULL DEFAULT 0;
UPDATE product_variants v SET
  cost_price = CASE WHEN v.cost_price = 0 THEN p.avg_cost ELSE v.cost_price END,
  compare_at_price = CASE WHEN v.compare_at_price = 0 THEN p.compare_at_price ELSE v.compare_at_price END
FROM products p WHERE p.id = v.product_id AND (v.cost_price = 0 OR v.compare_at_price = 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recovery_cart_id integer;
