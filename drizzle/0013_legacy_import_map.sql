CREATE TABLE IF NOT EXISTS "legacy_import_map" (
  "id" serial PRIMARY KEY,
  "source" text NOT NULL,
  "entity_type" text NOT NULL,
  "legacy_id" text NOT NULL,
  "target_id" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "legacy_import_map_unique" ON "legacy_import_map" ("source", "entity_type", "legacy_id");
CREATE INDEX IF NOT EXISTS "legacy_import_map_target" ON "legacy_import_map" ("entity_type", "target_id");
