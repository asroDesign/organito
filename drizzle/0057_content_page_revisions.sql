CREATE TABLE IF NOT EXISTS "content_page_revisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "page_id" integer NOT NULL,
  "document" jsonb NOT NULL,
  "created_by" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "content_page_revisions_page_created"
  ON "content_page_revisions" ("page_id", "created_at" DESC);
