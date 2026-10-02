-- Additive loyalty rewards ledger and configurable points per product variation.
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS loyalty_point_entries (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  order_id integer,
  reference text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_point_user_created ON loyalty_point_entries(user_id, created_at);
CREATE INDEX IF NOT EXISTS loyalty_point_kind_created ON loyalty_point_entries(kind, created_at);
INSERT INTO loyalty_point_entries(user_id,kind,points,amount,order_id,reference,description,created_at)
SELECT referrer_id,'referral',points,0,order_id,'legacy-referral:'||id,'امتیاز معرفی دوست (اطلاعات قبلی)',created_at FROM referral_awards
ON CONFLICT (reference) DO NOTHING;
