-- Scheduled discounts per central inventory variant. Existing prices and orders
-- are retained; promotions affect only quotes inside their validity window.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "variant_discount" bigint;

CREATE TABLE IF NOT EXISTS "variant_scheduled_discounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "variant_id" integer NOT NULL REFERENCES "product_variants"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "discount_percent" integer NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "variant_scheduled_discounts_percent_range" CHECK ("discount_percent" BETWEEN 1 AND 90),
  CONSTRAINT "variant_scheduled_discounts_valid_window" CHECK ("ends_at" > "starts_at")
);

CREATE INDEX IF NOT EXISTS "variant_scheduled_discounts_active_window"
  ON "variant_scheduled_discounts" ("variant_id", "is_active", "starts_at", "ends_at");
