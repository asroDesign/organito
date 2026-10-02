-- Additive customer identity and official invoice fields. Existing profile and order data are preserved.
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_national_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_manager text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS official_invoice_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS official_invoice_details jsonb;
