-- Add Melipayamak credentials without changing or deleting existing seller SMS settings.
ALTER TABLE seller_sms_settings ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE seller_sms_settings ADD COLUMN IF NOT EXISTS password text;
