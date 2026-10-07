CREATE TABLE IF NOT EXISTS product_alert_verifications (
  id serial PRIMARY KEY,
  phone text NOT NULL,
  product_id integer NOT NULL,
  variant_id integer NOT NULL DEFAULT 0,
  code_hash text NOT NULL,
  salt text NOT NULL,
  alert_restock boolean NOT NULL DEFAULT false,
  alert_price_drop boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_alert_verifications_phone_created ON product_alert_verifications(phone, created_at);

CREATE TABLE IF NOT EXISTS product_alert_subscriptions (
  id serial PRIMARY KEY,
  user_id integer,
  phone text NOT NULL,
  product_id integer NOT NULL,
  variant_id integer NOT NULL DEFAULT 0,
  alert_restock boolean NOT NULL DEFAULT false,
  alert_price_drop boolean NOT NULL DEFAULT false,
  consent_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_alert_subscription_identity UNIQUE(phone, product_id, variant_id)
);
CREATE INDEX IF NOT EXISTS product_alert_subscription_product_active ON product_alert_subscriptions(product_id, active);

CREATE TABLE IF NOT EXISTS product_alert_events (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  variant_id integer NOT NULL DEFAULT 0,
  event_type text NOT NULL CHECK (event_type IN ('restock', 'price_drop')),
  old_price bigint,
  new_price bigint,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS product_alert_events_pending ON product_alert_events(status, created_at);

CREATE TABLE IF NOT EXISTS product_alert_deliveries (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES product_alert_events(id) ON DELETE CASCADE,
  subscription_id integer NOT NULL REFERENCES product_alert_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT product_alert_delivery_once UNIQUE(event_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS product_alert_deliveries_subscription ON product_alert_deliveries(subscription_id, created_at);

-- Capture stock becoming available regardless of which application workflow updates inventory.
CREATE OR REPLACE FUNCTION enqueue_product_restock_alert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_key integer; variant_key integer; old_free integer; new_free integer;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    product_key := NEW.id; variant_key := 0;
    IF EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = NEW.id AND v.is_active AND v.deleted_at IS NULL) THEN RETURN NEW; END IF;
    old_free := OLD.on_hand - OLD.reserved; new_free := NEW.on_hand - NEW.reserved;
  ELSE
    product_key := NEW.product_id; variant_key := NEW.id;
    old_free := OLD.on_hand - OLD.reserved; new_free := NEW.on_hand - NEW.reserved;
  END IF;
  IF old_free <= 0 AND new_free > 0 THEN
    INSERT INTO product_alert_events(product_id, variant_id, event_type) VALUES(product_key, variant_key, 'restock');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS products_restock_alert ON products;
CREATE TRIGGER products_restock_alert AFTER UPDATE OF on_hand, reserved ON products FOR EACH ROW
WHEN ((OLD.on_hand - OLD.reserved) <= 0 AND (NEW.on_hand - NEW.reserved) > 0)
EXECUTE FUNCTION enqueue_product_restock_alert();
DROP TRIGGER IF EXISTS variants_restock_alert ON product_variants;
CREATE TRIGGER variants_restock_alert AFTER UPDATE OF on_hand, reserved ON product_variants FOR EACH ROW
WHEN ((OLD.on_hand - OLD.reserved) <= 0 AND (NEW.on_hand - NEW.reserved) > 0)
EXECUTE FUNCTION enqueue_product_restock_alert();
-- New variants may be created with stock already available.
CREATE OR REPLACE FUNCTION enqueue_new_variant_restock_alert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.on_hand - NEW.reserved > 0 AND NEW.is_active AND NEW.deleted_at IS NULL THEN
    INSERT INTO product_alert_events(product_id, variant_id, event_type) VALUES(NEW.product_id, NEW.id, 'restock');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS variants_insert_restock_alert ON product_variants;
CREATE TRIGGER variants_insert_restock_alert AFTER INSERT ON product_variants FOR EACH ROW EXECUTE FUNCTION enqueue_new_variant_restock_alert();

-- Price history is the shared write path for explicit product and variant price edits.
CREATE OR REPLACE FUNCTION enqueue_product_price_drop_alert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_price bigint; target_variant integer;
BEGIN
  IF NEW.source = 'baseline' OR NEW.scope NOT IN ('product', 'variant') THEN RETURN NEW; END IF;
  target_variant := CASE WHEN NEW.scope = 'variant' THEN COALESCE(NEW.variant_id, 0) ELSE 0 END;
  SELECT h.price INTO previous_price FROM product_price_history h
    WHERE h.product_id = NEW.product_id AND h.scope = NEW.scope
      AND (CASE WHEN NEW.scope = 'variant' THEN h.variant_id = NEW.variant_id ELSE true END)
      AND h.id <> NEW.id ORDER BY h.created_at DESC, h.id DESC LIMIT 1;
  IF previous_price IS NOT NULL AND NEW.price < previous_price THEN
    INSERT INTO product_alert_events(product_id, variant_id, event_type, old_price, new_price)
      VALUES(NEW.product_id, target_variant, 'price_drop', previous_price, NEW.price);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS product_price_drop_alert ON product_price_history;
CREATE TRIGGER product_price_drop_alert AFTER INSERT ON product_price_history FOR EACH ROW EXECUTE FUNCTION enqueue_product_price_drop_alert();
