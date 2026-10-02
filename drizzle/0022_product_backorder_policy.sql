-- Enable selling selected central products when available inventory is insufficient.
-- Additive migration; existing products keep the default strict stock policy.
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_backorder boolean NOT NULL DEFAULT false;
