-- Associate one managed stock location with each approved marketplace supplier.
ALTER TABLE inventory_warehouses ADD COLUMN IF NOT EXISTS seller_id integer REFERENCES sellers(id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_supplier_unique ON inventory_warehouses(seller_id) WHERE seller_id IS NOT NULL;
INSERT INTO inventory_warehouses(name,code,address,seller_id,enabled,is_default)
SELECT 'انبار تأمین‌کننده · '||s.shop_name,'SUP-'||s.id,coalesce(s.city,''),s.id,true,false
FROM sellers s WHERE s.status='approved'
ON CONFLICT DO NOTHING;
