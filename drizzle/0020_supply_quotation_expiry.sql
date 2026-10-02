-- Additive expiry metadata for supplier quotes and issued supply proformas.
ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS quotation_expires_at timestamptz;
ALTER TABLE supply_quotes ADD COLUMN IF NOT EXISTS valid_until timestamptz;
