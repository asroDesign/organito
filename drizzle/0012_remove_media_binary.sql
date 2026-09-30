ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_has_source";
ALTER TABLE "media" ALTER COLUMN "storage_path" SET NOT NULL;
ALTER TABLE "media" DROP COLUMN IF EXISTS "data";
ALTER TABLE "media" ADD CONSTRAINT "media_has_source" CHECK ("storage_path" <> '');
