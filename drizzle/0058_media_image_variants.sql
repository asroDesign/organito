ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "processing_status" text NOT NULL DEFAULT 'not_processed',
  ADD COLUMN IF NOT EXISTS "processing_error" text,
  ADD COLUMN IF NOT EXISTS "processed_at" timestamptz;

CREATE TABLE IF NOT EXISTS "media_variants" (
  "id" serial PRIMARY KEY NOT NULL,
  "media_id" integer NOT NULL REFERENCES "media"("id") ON DELETE CASCADE,
  "variant" text NOT NULL,
  "storage_path" text NOT NULL UNIQUE,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "crop_ratio" text NOT NULL,
  "focal_x" integer NOT NULL,
  "focal_y" integer NOT NULL,
  "quality" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "media_variants_media_variant"
  ON "media_variants" ("media_id", "variant");
CREATE INDEX IF NOT EXISTS "media_variants_media"
  ON "media_variants" ("media_id");
