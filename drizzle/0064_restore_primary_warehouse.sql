-- Restore the virtual central location if it was removed or never created.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_stock_product ON inventory_warehouse_stock(warehouse_id,product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_stock_variant ON inventory_warehouse_stock(warehouse_id,variant_id) WHERE variant_id IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM inventory_warehouses WHERE is_default=true) THEN
    UPDATE inventory_warehouses SET name='انبار مرکزی',enabled=true,is_default=true,updated_at=now() WHERE code='MAIN';
    IF NOT FOUND THEN
      INSERT INTO inventory_warehouses(name,code,enabled,is_default) VALUES('انبار مرکزی','MAIN',true,true)
      ON CONFLICT(code) DO UPDATE SET is_default=true,enabled=true,updated_at=now();
    END IF;
  END IF;
END $$;

-- Recreate the central warehouse's stock projection from canonical product balances.
UPDATE inventory_warehouse_stock ws SET on_hand=p.on_hand,reserved=p.reserved,updated_at=now()
FROM products p,inventory_warehouses w
WHERE w.is_default=true AND ws.warehouse_id=w.id AND ws.product_id=p.id AND ws.variant_id IS NULL
  AND p.source='central' AND p.status<>'deleted'
  AND NOT EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.is_active AND v.deleted_at IS NULL);

INSERT INTO inventory_warehouse_stock(warehouse_id,product_id,variant_id,on_hand,reserved)
SELECT w.id,p.id,NULL,p.on_hand,p.reserved FROM products p CROSS JOIN inventory_warehouses w
WHERE w.is_default=true AND p.source='central' AND p.status<>'deleted'
  AND NOT EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.is_active AND v.deleted_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM inventory_warehouse_stock ws WHERE ws.warehouse_id=w.id AND ws.product_id=p.id AND ws.variant_id IS NULL);

UPDATE inventory_warehouse_stock ws SET on_hand=v.on_hand,reserved=v.reserved,updated_at=now()
FROM product_variants v JOIN products p ON p.id=v.product_id,inventory_warehouses w
WHERE w.is_default=true AND ws.warehouse_id=w.id AND ws.product_id=v.product_id AND ws.variant_id=v.id
  AND p.source='central' AND p.status<>'deleted';

INSERT INTO inventory_warehouse_stock(warehouse_id,product_id,variant_id,on_hand,reserved)
SELECT w.id,v.product_id,v.id,v.on_hand,v.reserved
FROM product_variants v JOIN products p ON p.id=v.product_id CROSS JOIN inventory_warehouses w
WHERE w.is_default=true AND p.source='central' AND p.status<>'deleted'
  AND NOT EXISTS(SELECT 1 FROM inventory_warehouse_stock ws WHERE ws.warehouse_id=w.id AND ws.variant_id=v.id);
