-- Additive central-customer loyalty tiers; preserves existing points and member records.
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_tier text NOT NULL DEFAULT 'bronze';
ALTER TABLE central_loyalty_members ADD COLUMN IF NOT EXISTS loyalty_tier text NOT NULL DEFAULT 'bronze';

CREATE TABLE IF NOT EXISTS loyalty_tier_history (
  id serial PRIMARY KEY,
  user_id integer,
  phone text NOT NULL,
  from_tier text NOT NULL,
  to_tier text NOT NULL,
  lifetime_spent bigint NOT NULL DEFAULT 0,
  reason text NOT NULL,
  ref_type text NOT NULL,
  ref_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_tier_history_ref ON loyalty_tier_history(phone, ref_type, ref_id);
CREATE INDEX IF NOT EXISTS loyalty_tier_history_created ON loyalty_tier_history(created_at DESC);
