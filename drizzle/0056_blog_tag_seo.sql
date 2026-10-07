ALTER TABLE "blog_tags"
  ADD COLUMN IF NOT EXISTS "seo_title" text,
  ADD COLUMN IF NOT EXISTS "meta_description" text,
  ADD COLUMN IF NOT EXISTS "seo_keywords" text,
  ADD COLUMN IF NOT EXISTS "canonical_url" text;
