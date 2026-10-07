CREATE TABLE IF NOT EXISTS product_price_history (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  scope text NOT NULL CHECK (scope IN ('product', 'variant', 'seller_offer')),
  variant_id integer,
  seller_offer_id integer,
  seller_id integer,
  price bigint NOT NULL DEFAULT 0,
  reference_price bigint NOT NULL DEFAULT 0,
  source text NOT NULL,
  changed_by integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_price_history_product_created
  ON product_price_history(product_id, created_at);
CREATE INDEX IF NOT EXISTS product_price_history_variant_created
  ON product_price_history(variant_id, created_at);
CREATE INDEX IF NOT EXISTS product_price_history_offer_created
  ON product_price_history(seller_offer_id, created_at);

-- Preserve current values as the start of the tracked timeline; this is a baseline,
-- not an assertion about earlier price changes.
INSERT INTO product_price_history (product_id, scope, price, reference_price, source)
SELECT p.id, 'product', p.base_price, p.compare_at_price, 'baseline'
FROM products p
WHERE p.status <> 'deleted'
  AND NOT EXISTS (SELECT 1 FROM product_price_history h WHERE h.product_id = p.id AND h.scope = 'product');

INSERT INTO product_price_history (product_id, scope, variant_id, price, reference_price, source)
SELECT v.product_id, 'variant', v.id, COALESCE(v.price, p.base_price), v.compare_at_price, 'baseline'
FROM product_variants v
JOIN products p ON p.id = v.product_id
WHERE v.deleted_at IS NULL AND v.is_active AND p.status <> 'deleted'
  AND NOT EXISTS (SELECT 1 FROM product_price_history h WHERE h.variant_id = v.id AND h.scope = 'variant');

INSERT INTO product_price_history (product_id, scope, seller_offer_id, seller_id, price, reference_price, source)
SELECT o.product_id, 'seller_offer', o.id, o.seller_id, COALESCE(o.sale_price, o.price), o.price, 'baseline'
FROM seller_offers o
JOIN products p ON p.id = o.product_id
JOIN sellers s ON s.id = o.seller_id
WHERE o.status = 'approved' AND s.status = 'approved' AND NOT s.restricted AND p.status <> 'deleted'
  AND NOT EXISTS (SELECT 1 FROM product_price_history h WHERE h.seller_offer_id = o.id AND h.scope = 'seller_offer');
