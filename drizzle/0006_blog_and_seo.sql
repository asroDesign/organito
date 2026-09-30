ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_keywords text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS canonical_url text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS blog_posts (
  id serial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  cover_image_id integer,
  category text NOT NULL DEFAULT 'سلامت و سبک زندگی',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  meta_description text,
  canonical_url text,
  status text NOT NULL DEFAULT 'draft',
  author_id integer NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_posts_status_published ON blog_posts(status, published_at);
CREATE INDEX IF NOT EXISTS blog_posts_category ON blog_posts(category);
