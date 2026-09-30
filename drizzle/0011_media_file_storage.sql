ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "storage_path" text;
CREATE UNIQUE INDEX IF NOT EXISTS "media_storage_path_unique" ON "media" ("storage_path") WHERE "storage_path" IS NOT NULL;
ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_has_source";
ALTER TABLE "media" ADD CONSTRAINT "media_has_source" CHECK ("data" IS NOT NULL OR "storage_path" IS NOT NULL OR "external_url" IS NOT NULL) NOT VALID;
