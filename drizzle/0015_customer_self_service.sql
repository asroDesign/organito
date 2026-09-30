-- Additive customer self-service features. Existing records and seller wallet tables are preserved.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_info" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_id" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "marketing_points" integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique" ON "users" ("referral_code") WHERE "referral_code" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_referred_by" ON "users" ("referred_by_id");

CREATE TABLE IF NOT EXISTS "customer_wallets" (
  "user_id" integer PRIMARY KEY REFERENCES "users"("id"),
  "balance" bigint NOT NULL DEFAULT 0 CHECK ("balance" >= 0),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "customer_wallet_entries" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "amount" bigint NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "reference" text UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "customer_wallet_entries_user_created" ON "customer_wallet_entries" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL DEFAULT 'خانه',
  "receiver_name" text NOT NULL,
  "receiver_phone" text NOT NULL,
  "city" text NOT NULL,
  "address" text NOT NULL,
  "postal_code" text,
  "latitude" text,
  "longitude" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "customer_addresses_user" ON "customer_addresses" ("user_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_addresses_one_default" ON "customer_addresses" ("user_id") WHERE "is_default";

CREATE TABLE IF NOT EXISTS "customer_favorites" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "product_id" integer NOT NULL REFERENCES "products"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "customer_favorites_user_product" ON "customer_favorites" ("user_id", "product_id");
CREATE INDEX IF NOT EXISTS "customer_favorites_user_created" ON "customer_favorites" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "referral_awards" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL UNIQUE REFERENCES "orders"("id"),
  "referrer_id" integer NOT NULL REFERENCES "users"("id"),
  "buyer_id" integer NOT NULL REFERENCES "users"("id"),
  "points" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "referral_awards_referrer" ON "referral_awards" ("referrer_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "customer_wallet_withdrawals" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "amount" bigint NOT NULL CHECK ("amount" > 0),
  "bank_info" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "note" text,
  "admin_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "customer_wallet_withdrawals_user" ON "customer_wallet_withdrawals" ("user_id", "created_at" DESC);
