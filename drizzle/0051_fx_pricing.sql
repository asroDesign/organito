CREATE TABLE IF NOT EXISTS fx_rates (
  currency_code text PRIMARY KEY,
  currency_name text NOT NULL,
  rate_value bigint NOT NULL CHECK (rate_value > 0),
  source text NOT NULL,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fx_product_prices (
  id serial PRIMARY KEY,
  target_key text NOT NULL UNIQUE,
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer,
  currency_code text NOT NULL REFERENCES fx_rates(currency_code),
  foreign_amount bigint NOT NULL CHECK (foreign_amount > 0),
  markup_percent integer NOT NULL DEFAULT 0 CHECK (markup_percent BETWEEN 0 AND 500),
  rounding_step bigint NOT NULL DEFAULT 1 CHECK (rounding_step > 0),
  source_note text,
  updated_by integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_applied_rate bigint,
  last_applied_at timestamptz
);

CREATE INDEX IF NOT EXISTS fx_product_prices_product_idx ON fx_product_prices (product_id, variant_id);
CREATE INDEX IF NOT EXISTS fx_product_prices_currency_idx ON fx_product_prices (currency_code);
