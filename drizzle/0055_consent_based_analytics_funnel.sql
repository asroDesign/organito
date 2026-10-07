-- Optional, first-party funnel analytics. Store only short-lived random session IDs,
-- coarse page keys and product IDs; do not collect IP addresses or raw URLs.
CREATE TABLE IF NOT EXISTS analytics_events (
  event_id text PRIMARY KEY,
  session_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'product_view', 'add_to_cart', 'checkout_started')),
  page_key text NOT NULL CHECK (page_key IN ('home', 'shop', 'product', 'blog', 'cart')),
  product_id integer,
  source text NOT NULL DEFAULT 'direct',
  medium text,
  campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
CREATE INDEX IF NOT EXISTS analytics_events_session_type_created ON analytics_events(session_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_created_expires ON analytics_events(created_at, expires_at);
CREATE INDEX IF NOT EXISTS analytics_events_product_created ON analytics_events(product_id, created_at);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS analytics_session_id text;
CREATE INDEX IF NOT EXISTS orders_analytics_session_created ON orders(analytics_session_id, created_at);
