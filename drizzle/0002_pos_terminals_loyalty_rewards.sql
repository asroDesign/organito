CREATE TABLE IF NOT EXISTS pos_terminals (
  id serial PRIMARY KEY,
  seller_id integer,
  name text NOT NULL,
  bank_name text,
  terminal_code text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_terminal_seller_enabled ON pos_terminals (seller_id, enabled);

ALTER TABLE central_pos_sales ADD COLUMN IF NOT EXISTS terminal_id integer;
ALTER TABLE seller_pos_sales ADD COLUMN IF NOT EXISTS terminal_id integer;
ALTER TABLE seller_loyalty_members ADD COLUMN IF NOT EXISTS birthdate timestamptz;
ALTER TABLE seller_loyalty_clubs ADD COLUMN IF NOT EXISTS reward_percent integer NOT NULL DEFAULT 10;
ALTER TABLE seller_loyalty_clubs ADD COLUMN IF NOT EXISTS reward_min_subtotal bigint NOT NULL DEFAULT 300000;
ALTER TABLE seller_loyalty_clubs ADD COLUMN IF NOT EXISTS reward_validity_days integer NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS seller_loyalty_rewards (
  id serial PRIMARY KEY,
  seller_id integer NOT NULL,
  club_id integer NOT NULL,
  member_phone text NOT NULL,
  code text NOT NULL UNIQUE,
  sale_id integer NOT NULL,
  discount_percent integer NOT NULL,
  min_subtotal bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_loyalty_reward_owner ON seller_loyalty_rewards (seller_id, member_phone, expires_at);
