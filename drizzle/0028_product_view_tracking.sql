CREATE TABLE IF NOT EXISTS product_view_logs (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  ip text NOT NULL,
  user_agent text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_view_logs_product_viewed
  ON product_view_logs (product_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS product_view_presence (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  session_id text NOT NULL,
  ip text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_view_presence_product_session UNIQUE (product_id, session_id)
);
CREATE INDEX IF NOT EXISTS product_view_presence_product_seen
  ON product_view_presence (product_id, last_seen_at DESC);
