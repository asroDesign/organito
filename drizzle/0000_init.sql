CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"type" text NOT NULL,
	"parent_id" integer,
	CONSTRAINT "accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"carrier_id" integer NOT NULL,
	"city" text,
	"min_weight" integer DEFAULT 0 NOT NULL,
	"max_weight" integer DEFAULT 1000000 NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"tracking_url" text,
	"base_cost" bigint DEFAULT 0 NOT NULL,
	"per_kg_cost" bigint DEFAULT 0 NOT NULL,
	"free_threshold" bigint DEFAULT 0 NOT NULL,
	"min_days" integer DEFAULT 1 NOT NULL,
	"max_days" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "carriers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" integer,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "detail_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"parent_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "detail_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'percent' NOT NULL,
	"value" integer NOT NULL,
	"max_discount" bigint DEFAULT 0 NOT NULL,
	"min_order" bigint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"customer_id" integer,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "discount_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#e11d48' NOT NULL,
	"discount_percent" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "festivals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"description" text NOT NULL,
	"ref_type" text,
	"ref_id" integer,
	"status" text DEFAULT 'posted' NOT NULL,
	"reversal_of" integer,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"detail1" text,
	"detail2" text,
	"detail3" text,
	"detail1_id" integer,
	"detail2_id" integer,
	"detail3_id" integer,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"offer_id" integer,
	"seller_id" integer,
	"shipment_id" integer,
	"title" text NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"qty" integer NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"items_subtotal" bigint DEFAULT 0 NOT NULL,
	"seller_shipping_total" bigint DEFAULT 0 NOT NULL,
	"central_shipping" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"address" jsonb NOT NULL,
	"festival_discount" bigint DEFAULT 0 NOT NULL,
	"code_discount" bigint DEFAULT 0 NOT NULL,
	"discount_code_id" integer,
	"discount_code" text,
	"carrier_id" integer,
	"idempotency_key" text,
	"payment_entry_id" integer,
	"customer_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"supply_request_id" integer,
	"amount" bigint DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'gateway' NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"ref_code" text,
	"gateway" text,
	"authority" text,
	"card_masked" text,
	"payer_name" text,
	"bank_name" text,
	"tracking_code" text,
	"paid_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"receipt_media_id" integer,
	"note" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_by" integer,
	"verified_by" integer,
	"verified_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"title" text NOT NULL,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sku" text NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_fa" text NOT NULL,
	"name_en" text,
	"sku" text NOT NULL,
	"part_number" text NOT NULL,
	"normalized_pn" text NOT NULL,
	"oem_number" text,
	"cross_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand" text NOT NULL,
	"manufacturer" text,
	"country" text,
	"category_id" integer,
	"authenticity" text DEFAULT 'Aftermarket' NOT NULL,
	"base_price" bigint DEFAULT 0 NOT NULL,
	"compare_at_price" bigint DEFAULT 0 NOT NULL,
	"short_desc" text,
	"description" text,
	"technical_review" text,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compatibility" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weight" integer,
	"barcode" text,
	"seo_title" text,
	"meta_desc" text,
	"slug" text NOT NULL,
	"main_image_id" integer,
	"source" text DEFAULT 'central' NOT NULL,
	"owner_seller_id" integer,
	"created_by" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"reject_reason" text,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 3 NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avg_cost" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "seller_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"media_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"requested_by" integer,
	"request_note" text,
	"review_note" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"sale_price" bigint,
	"stock" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"shipping_cost" bigint DEFAULT 0 NOT NULL,
	"prep_days" integer DEFAULT 1 NOT NULL,
	"ship_city" text,
	"warranty" text,
	"condition" text DEFAULT 'new' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_buy_box" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"seller_id" integer,
	"items_total" bigint DEFAULT 0 NOT NULL,
	"shipping_cost" bigint DEFAULT 0 NOT NULL,
	"commission" bigint DEFAULT 0 NOT NULL,
	"deductions" bigint DEFAULT 0 NOT NULL,
	"carrier" text,
	"carrier_id" integer,
	"weight" integer DEFAULT 0 NOT NULL,
	"tracking_number" text,
	"package_count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"prep_days" integer DEFAULT 1 NOT NULL,
	"prepared_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"settled" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shop_name" text NOT NULL,
	"city" text DEFAULT 'تهران' NOT NULL,
	"rating" real DEFAULT 4.5 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"contract_status" text DEFAULT 'pending' NOT NULL,
	"commission_rate" integer DEFAULT 8 NOT NULL,
	"settlement_days" integer DEFAULT 7 NOT NULL,
	"legal_docs" text,
	"national_id" text,
	"iban" text,
	"entity_type" text DEFAULT 'individual' NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kyc_status" text DEFAULT 'incomplete' NOT NULL,
	"restricted" boolean DEFAULT false NOT NULL,
	"restrict_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"phone" text NOT NULL,
	"provider" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"response" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"pattern_id" text,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"offer_id" integer,
	"type" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"ref_type" text,
	"ref_id" integer,
	"note" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"lead_days" integer DEFAULT 0 NOT NULL,
	"brand" text,
	"note" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"method" text DEFAULT 'part_number' NOT NULL,
	"part_number" text,
	"normalized_pn" text,
	"part_name" text,
	"car_make" text,
	"car_model" text,
	"car_year" text,
	"vin" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"description" text,
	"media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assignee_id" integer,
	"matched_product_id" integer,
	"selected_quote_id" integer,
	"margin_percent" integer DEFAULT 15 NOT NULL,
	"unit_sale_price" bigint DEFAULT 0 NOT NULL,
	"shipping_cost" bigint DEFAULT 0 NOT NULL,
	"quotation_total" bigint DEFAULT 0 NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supply_requests_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "ticket_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ticket_departments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"media_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"subject" text NOT NULL,
	"department" text DEFAULT 'support' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_id" integer,
	"order_id" integer,
	"product_id" integer,
	"payment_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"extra_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"type" text NOT NULL,
	"bucket" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"ref_type" text,
	"ref_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"pending_balance" bigint DEFAULT 0 NOT NULL,
	"available_balance" bigint DEFAULT 0 NOT NULL,
	"locked_balance" bigint DEFAULT 0 NOT NULL,
	"withdrawn_balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_seller_id_unique" UNIQUE("seller_id")
);
--> statement-breakpoint
CREATE TABLE "warehouse_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"shipment_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"seller_id" integer,
	"status" text DEFAULT 'issued' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"package_count" integer DEFAULT 1 NOT NULL,
	"carrier" text,
	"warehouse_name" text,
	"notes" text,
	"issued_by" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"receiver_name" text,
	"receiver_phone" text,
	"receiver_national_id" text,
	"receiver_role" text,
	"handed_over_by" integer,
	"handed_over_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_issues_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"iban" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tracking_code" text,
	"reviewed_by" integer,
	"note" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawals_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE INDEX "audit_entity" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "jl_entry" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "jl_account" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "products_pn_idx" ON "products" USING btree ("normalized_pn");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sd_seller" ON "seller_documents" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_product_seller" ON "seller_offers" USING btree ("product_id","seller_id");--> statement-breakpoint
CREATE INDEX "wi_shipment" ON "warehouse_issues" USING btree ("shipment_id");