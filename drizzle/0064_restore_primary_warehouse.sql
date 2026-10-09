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
INSERT INTO inventory_warehouse_stock(warehouse_id,product_id,variant_id,on_hand,reserved)
SELECT w.id,p.id,NULL,p.on_hand,p.reserved
FROM products p CROSS JOIN inventory_warehouses w
WHERE w.is_default=true AND p.source='central' AND p.status<>'deleted'
  AND NOT EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.is_active AND v.deleted_at IS NULL)
ON CONFLICT(warehouse_id,product_id) WHERE variant_id IS NULL
DO UPDATE SET on_hand=EXCLUDED.on_hand,reserved=EXCLUDED.reserved,updated_at=now();

INSERT INTO inventory_warehouse_stock(warehouse_id,product_id,variant_id,on_hand,reserved)
SELECT w.id,v.product_id,v.id,v.on_hand,v.reserved
FROM product_variants v JOIN products p ON p.id=v.product_id CROSS JOIN inventory_warehouses w
WHERE w.is_default=true AND p.source='central' AND p.status<>'deleted'
ON CONFLICT(warehouse_id,variant_id) WHERE variant_id IS NOT NULL
DO UPDATE SET on_hand=EXCLUDED.on_hand,reserved=EXCLUDED.reserved,updated_at=now();
