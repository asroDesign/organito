-- Recoverable trash for catalog and editorial content. No business or order rows are deleted.
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_by integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_from_status text;
UPDATE products SET deleted_at = now() WHERE status = 'deleted' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_deleted_at ON products(deleted_at);

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS deleted_by integer;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS deleted_from_status text;
CREATE INDEX IF NOT EXISTS blog_posts_deleted_at ON blog_posts(deleted_at);

ALTER TABLE brands ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS deleted_by integer;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS deleted_was_active boolean;
CREATE INDEX IF NOT EXISTS brands_deleted_at ON brands(deleted_at);

ALTER TABLE content_pages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE content_pages ADD COLUMN IF NOT EXISTS deleted_by integer;
ALTER TABLE content_pages ADD COLUMN IF NOT EXISTS deleted_from_status text;
CREATE INDEX IF NOT EXISTS content_pages_deleted_at ON content_pages(deleted_at);
