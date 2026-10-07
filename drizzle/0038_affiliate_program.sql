-- Additive affiliate-program schema. Existing customer referral points remain untouched.
CREATE TABLE IF NOT EXISTS affiliate_program_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  bronze_rate_bps integer NOT NULL DEFAULT 300 CHECK (bronze_rate_bps BETWEEN 0 AND 10000),
  silver_rate_bps integer NOT NULL DEFAULT 500 CHECK (silver_rate_bps BETWEEN 0 AND 10000),
  gold_rate_bps integer NOT NULL DEFAULT 700 CHECK (gold_rate_bps BETWEEN 0 AND 10000),
  minimum_withdrawal bigint NOT NULL DEFAULT 100000,
  attribution_days integer NOT NULL DEFAULT 90 CHECK (attribution_days BETWEEN 1 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO affiliate_program_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS affiliate_profiles (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS affiliate_profiles_status_tier ON affiliate_profiles(status, tier);

CREATE TABLE IF NOT EXISTS affiliate_product_rules (
  id serial PRIMARY KEY,
  product_id integer NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  bronze_rate_bps integer CHECK (bronze_rate_bps BETWEEN 0 AND 10000),
  silver_rate_bps integer CHECK (silver_rate_bps BETWEEN 0 AND 10000),
  gold_rate_bps integer CHECK (gold_rate_bps BETWEEN 0 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id bigserial PRIMARY KEY,
  affiliate_user_id integer NOT NULL REFERENCES affiliate_profiles(user_id) ON DELETE CASCADE,
  landing_path text NOT NULL DEFAULT '/',
  referrer_host text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_clicks_owner_created ON affiliate_clicks(affiliate_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id bigserial PRIMARY KEY,
  affiliate_user_id integer NOT NULL REFERENCES affiliate_profiles(user_id),
  order_id integer NOT NULL REFERENCES orders(id),
  order_item_id integer REFERENCES order_items(id),
  reverses_earning_id bigint REFERENCES affiliate_earnings(id),
  product_id integer NOT NULL REFERENCES products(id),
  base_amount bigint NOT NULL DEFAULT 0,
  amount bigint NOT NULL DEFAULT 0,
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  tier text NOT NULL CHECK (tier IN ('bronze','silver','gold')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','void','reversed')),
  journal_entry_id integer REFERENCES journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz,
  CHECK (order_item_id IS NOT NULL OR reverses_earning_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_earning_item_owner ON affiliate_earnings(affiliate_user_id, order_item_id) WHERE order_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_earning_reversal ON affiliate_earnings(reverses_earning_id) WHERE reverses_earning_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliate_earning_owner_status ON affiliate_earnings(affiliate_user_id, status);
CREATE INDEX IF NOT EXISTS affiliate_earning_order ON affiliate_earnings(order_id);

CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id bigserial PRIMARY KEY,
  affiliate_user_id integer NOT NULL REFERENCES affiliate_profiles(user_id),
  amount bigint NOT NULL CHECK (amount > 0),
  bank_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  admin_note text,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS affiliate_withdrawal_owner_status ON affiliate_withdrawals(affiliate_user_id, status);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_user_id integer REFERENCES affiliate_profiles(user_id);
CREATE INDEX IF NOT EXISTS orders_affiliate_user ON orders(affiliate_user_id);
