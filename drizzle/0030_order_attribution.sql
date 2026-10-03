ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS attribution jsonb;

COMMENT ON COLUMN orders.attribution IS 'First-touch acquisition source and campaign details captured for the order';
