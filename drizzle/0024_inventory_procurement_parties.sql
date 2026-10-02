-- Producers and suppliers are separate from marketplace seller accounts.
-- These additive tables preserve all existing stock, journal and supplier data.
CREATE TABLE IF NOT EXISTS inventory_parties (
  id serial PRIMARY KEY,
  name text NOT NULL,
  phone text,
  national_id text,
  address text,
  detail_account_id integer,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_receipts (
  id serial PRIMARY KEY,
  number text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'purchase',
  party_id integer NOT NULL,
  product_id integer NOT NULL,
  variant_id integer,
  quantity integer NOT NULL,
  unit_cost bigint NOT NULL DEFAULT 0,
  freight bigint NOT NULL DEFAULT 0,
  customs bigint NOT NULL DEFAULT 0,
  total bigint NOT NULL DEFAULT 0,
  invoice_number text,
  payment_location text,
  payment_tracking_number text,
  paid_amount bigint NOT NULL DEFAULT 0,
  note text,
  journal_entry_id integer,
  user_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_receipts_party_created ON inventory_receipts(party_id, created_at);

CREATE TABLE IF NOT EXISTS inventory_consignment_lots (
  id serial PRIMARY KEY,
  receipt_id integer NOT NULL,
  party_id integer NOT NULL,
  product_id integer NOT NULL,
  variant_id integer,
  initial_qty integer NOT NULL,
  remaining_qty integer NOT NULL,
  unit_cost bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_consignments_variant_created ON inventory_consignment_lots(variant_id, created_at);

CREATE TABLE IF NOT EXISTS inventory_consignment_usages (
  id serial PRIMARY KEY,
  lot_id integer NOT NULL,
  receipt_id integer NOT NULL,
  party_id integer NOT NULL,
  product_id integer NOT NULL,
  variant_id integer,
  quantity integer NOT NULL,
  unit_cost bigint NOT NULL DEFAULT 0,
  action text NOT NULL,
  ref_type text NOT NULL,
  ref_id integer NOT NULL,
  reversed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_consignment_usage_ref ON inventory_consignment_usages(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS inventory_consignment_usage_lot ON inventory_consignment_usages(lot_id);

CREATE TABLE IF NOT EXISTS inventory_supplier_payments (
  id serial PRIMARY KEY,
  party_id integer NOT NULL,
  amount bigint NOT NULL,
  payment_location text NOT NULL,
  tracking_number text,
  note text,
  journal_entry_id integer,
  user_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_supplier_payments_party_created ON inventory_supplier_payments(party_id, created_at);
