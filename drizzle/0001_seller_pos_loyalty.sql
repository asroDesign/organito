CREATE TABLE IF NOT EXISTS pos_terminals (id serial PRIMARY KEY, seller_id integer, name text NOT NULL, bank_name text, terminal_code text, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS pos_terminal_seller_enabled ON pos_terminals (seller_id, enabled);
CREATE TABLE IF NOT EXISTS central_pos_sales (id serial PRIMARY KEY, number text NOT NULL UNIQUE, idempotency_key text NOT NULL UNIQUE, created_by integer NOT NULL, customer_name text NOT NULL, customer_phone text NOT NULL, subtotal bigint NOT NULL DEFAULT 0, discount bigint NOT NULL DEFAULT 0, total bigint NOT NULL DEFAULT 0, payment_method text NOT NULL, settlement jsonb NOT NULL DEFAULT '{"cash":0,"card":0}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE central_pos_sales ADD COLUMN IF NOT EXISTS terminal_id integer;
CREATE INDEX IF NOT EXISTS central_pos_created ON central_pos_sales (created_at);
CREATE TABLE IF NOT EXISTS central_pos_items (id serial PRIMARY KEY, sale_id integer NOT NULL, variant_id integer NOT NULL, product_id integer NOT NULL, title text NOT NULL, quantity integer NOT NULL, unit_price bigint NOT NULL DEFAULT 0, line_total bigint NOT NULL DEFAULT 0, unit_cost bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS central_pos_items_sale ON central_pos_items (sale_id);
CREATE TABLE IF NOT EXISTS seller_pos_sales (
  id serial PRIMARY KEY,
  number text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  seller_id integer NOT NULL,
  created_by integer NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  subtotal bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  total bigint NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  settlement jsonb NOT NULL DEFAULT '{"cash":0,"card":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seller_pos_sales ADD COLUMN IF NOT EXISTS terminal_id integer;
CREATE INDEX IF NOT EXISTS seller_pos_seller_created ON seller_pos_sales (seller_id, created_at);

CREATE TABLE IF NOT EXISTS seller_pos_items (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL,
  seller_id integer NOT NULL,
  offer_id integer NOT NULL,
  product_id integer NOT NULL,
  title text NOT NULL,
  quantity integer NOT NULL,
  unit_price bigint NOT NULL DEFAULT 0,
  line_total bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_pos_items_sale ON seller_pos_items (sale_id);
CREATE INDEX IF NOT EXISTS seller_pos_items_seller ON seller_pos_items (seller_id);

CREATE TABLE IF NOT EXISTS seller_loyalty_clubs (
  id serial PRIMARY KEY,
  seller_id integer NOT NULL UNIQUE,
  name text NOT NULL,
  reward_percent integer NOT NULL DEFAULT 10,
  reward_min_subtotal bigint NOT NULL DEFAULT 300000,
  reward_validity_days integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seller_loyalty_clubs ADD COLUMN IF NOT EXISTS reward_percent integer NOT NULL DEFAULT 10;
ALTER TABLE seller_loyalty_clubs ADD COLUMN IF NOT EXISTS reward_min_subtotal bigint NOT NULL DEFAULT 300000;
ALTER TABLE seller_loyalty_clubs ADD COLUMN IF NOT EXISTS reward_validity_days integer NOT NULL DEFAULT 60;
CREATE TABLE IF NOT EXISTS seller_loyalty_members (
  id serial PRIMARY KEY,
  club_id integer NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  sms_consent boolean NOT NULL DEFAULT false,
  visits integer NOT NULL DEFAULT 0,
  total_spent bigint NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_loyalty_member_phone UNIQUE (club_id, phone)
);
ALTER TABLE seller_loyalty_members ADD COLUMN IF NOT EXISTS birthdate timestamptz;
CREATE INDEX IF NOT EXISTS seller_loyalty_member_club ON seller_loyalty_members (club_id);

CREATE TABLE IF NOT EXISTS seller_loyalty_rewards (
  id serial PRIMARY KEY, seller_id integer NOT NULL, club_id integer NOT NULL, member_phone text NOT NULL, code text NOT NULL UNIQUE, sale_id integer NOT NULL, discount_percent integer NOT NULL, min_subtotal bigint NOT NULL, expires_at timestamptz NOT NULL, redeemed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_loyalty_reward_owner ON seller_loyalty_rewards (seller_id, member_phone, expires_at);

CREATE TABLE IF NOT EXISTS seller_sms_settings (
  id serial PRIMARY KEY,
  seller_id integer NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'simulate',
  api_key text,
  sender_number text,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
