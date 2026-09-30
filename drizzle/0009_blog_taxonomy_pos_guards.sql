CREATE TABLE IF NOT EXISTS "blog_categories" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "blog_categories_name_unique" ON "blog_categories" ("name");
CREATE INDEX IF NOT EXISTS "blog_categories_order" ON "blog_categories" ("sort_order");

CREATE TABLE IF NOT EXISTS "blog_tags" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "blog_tags_name_unique" ON "blog_tags" ("name");

INSERT INTO "blog_categories" ("name", "slug")
SELECT DISTINCT trim("category"), 'category-' || substr(md5(trim("category")), 1, 12)
FROM "blog_posts"
WHERE trim(coalesce("category", '')) <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "blog_categories" ("name", "slug")
VALUES ('سلامت و سبک زندگی', 'health-lifestyle')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "blog_tags" ("name", "slug")
SELECT DISTINCT trim(tag), 'tag-' || substr(md5(trim(tag)), 1, 12)
FROM "blog_posts", jsonb_array_elements_text(coalesce("tags", '[]'::jsonb)) AS tag
WHERE trim(tag) <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "product_variants" ("product_id", "title", "attrs", "sku", "price", "on_hand", "reserved", "is_active")
SELECT p."id", 'پیش‌فرض', '{}'::jsonb, p."sku" || '-DEFAULT-' || p."id", p."base_price", p."on_hand", p."reserved", true
FROM "products" p
WHERE p."source" = 'central'
  AND NOT EXISTS (SELECT 1 FROM "product_variants" v WHERE v."product_id" = p."id");

ALTER TABLE "central_pos_sales" DROP CONSTRAINT IF EXISTS "central_pos_amounts_valid";
ALTER TABLE "central_pos_sales" ADD CONSTRAINT "central_pos_amounts_valid"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "discount" <= "subtotal" AND "total" = "subtotal" - "discount") NOT VALID;

ALTER TABLE "seller_pos_sales" DROP CONSTRAINT IF EXISTS "seller_pos_amounts_valid";
ALTER TABLE "seller_pos_sales" ADD CONSTRAINT "seller_pos_amounts_valid"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "discount" <= "subtotal" AND "total" = "subtotal" - "discount") NOT VALID;
