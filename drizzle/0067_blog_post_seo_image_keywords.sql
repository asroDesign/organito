ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_image_id integer;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;
