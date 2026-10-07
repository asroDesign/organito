CREATE TABLE IF NOT EXISTS brands (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_media_id integer,
  banner_media_id integer,
  description text,
  seo_title text,
  meta_description text,
  seo_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  canonical_url text,
  related_blog_post_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brands_active_sort ON brands(is_active, sort_order);
CREATE INDEX IF NOT EXISTS brands_name_lower ON brands(name);
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_normalized_unique ON brands(lower(btrim(name)));

-- Backfill one brand entity per normalized legacy product brand without changing product records.
DO $$
DECLARE r record; candidate text; suffix integer;
BEGIN
  FOR r IN
    SELECT min(regexp_replace(btrim(brand), '\s+', ' ', 'g')) AS name, lower(regexp_replace(btrim(brand), '\s+', ' ', 'g')) AS normalized
    FROM products WHERE btrim(brand) <> '' AND status <> 'deleted'
    GROUP BY lower(regexp_replace(btrim(brand), '\s+', ' ', 'g'))
    ORDER BY lower(regexp_replace(btrim(brand), '\s+', ' ', 'g'))
  LOOP
    IF NOT EXISTS (SELECT 1 FROM brands WHERE lower(btrim(name)) = lower(btrim(r.name))) THEN
      candidate := btrim(regexp_replace(lower(r.name), '[^[:alnum:]ء-ي۰-۹]+', '-', 'g'), '-');
      IF candidate = '' THEN candidate := 'brand-' || substr(md5(r.normalized), 1, 10); END IF;
      suffix := 1;
      WHILE EXISTS (SELECT 1 FROM brands WHERE slug = candidate) LOOP
        candidate := btrim(regexp_replace(lower(r.name), '[^[:alnum:]ء-ي۰-۹]+', '-', 'g'), '-') || '-' || suffix::text;
        suffix := suffix + 1;
      END LOOP;
      INSERT INTO brands(name, slug, is_active, sort_order)
      VALUES (r.name, candidate, true, 0) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
