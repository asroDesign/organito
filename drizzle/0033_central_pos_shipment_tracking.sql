ALTER TABLE central_pos_sales
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS shipping_tracking_number text,
  ADD COLUMN IF NOT EXISTS shipping_shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_notes text;

CREATE INDEX IF NOT EXISTS central_pos_shipping_queue
  ON central_pos_sales (shipping_status, created_at DESC)
  WHERE shipping_address IS NOT NULL;
