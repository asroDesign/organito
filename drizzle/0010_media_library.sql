CREATE TABLE IF NOT EXISTS "media_folders" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "parent_id" integer,
  "color" text,
  "legacy_id" integer,
  "created_by" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "media_folders_parent" ON "media_folders" ("parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "media_folders_legacy_unique" ON "media_folders" ("legacy_id") WHERE "legacy_id" IS NOT NULL;

ALTER TABLE "media" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "alt" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "folder_id" integer;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "external_url" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "legacy_source" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "legacy_id" integer;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS "media_folder_created" ON "media" ("folder_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "media_legacy_unique" ON "media" ("legacy_source", "legacy_id") WHERE "legacy_source" IS NOT NULL AND "legacy_id" IS NOT NULL;
ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_has_source";
ALTER TABLE "media" ADD CONSTRAINT "media_has_source" CHECK ("data" IS NOT NULL OR "external_url" IS NOT NULL) NOT VALID;
