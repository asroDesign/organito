CREATE TABLE IF NOT EXISTS pickup_centers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  city text NOT NULL,
  address text NOT NULL,
  phone text,
  latitude text,
  longitude text,
  opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_capacity integer NOT NULL DEFAULT 30 CHECK (daily_capacity > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_center_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_center_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_ready_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS pickup_centers_active_name ON pickup_centers (is_active, name);
CREATE INDEX IF NOT EXISTS orders_pickup_capacity ON orders (pickup_center_id, pickup_date, status)
  WHERE fulfillment_type = 'pickup';
