ALTER TABLE "sms_templates"
  ADD COLUMN IF NOT EXISTS "parameter_map" jsonb NOT NULL DEFAULT '{}'::jsonb;
