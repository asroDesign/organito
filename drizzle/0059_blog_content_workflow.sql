-- Blog media types and editorial review workflow. Existing articles keep their
-- status, body, author, and publication date; new fields are additive.
ALTER TABLE "blog_posts"
  ADD COLUMN IF NOT EXISTS "content_type" text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS "video_media_id" integer,
  ADD COLUMN IF NOT EXISTS "audio_media_id" integer,
  ADD COLUMN IF NOT EXISTS "review_note" text,
  ADD COLUMN IF NOT EXISTS "reviewed_by" integer,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz;

CREATE INDEX IF NOT EXISTS "blog_posts_review_queue"
  ON "blog_posts" ("status", "updated_at")
  WHERE "deleted_at" IS NULL;
