-- Additive document headers. Existing receipts, stock and journal entries are retained.
CREATE TABLE IF NOT EXISTS inventory_documents (
 id serial PRIMARY KEY, number text NOT NULL UNIQUE, type text NOT NULL,
 status text NOT NULL, idempotency_key text NOT NULL UNIQUE, payload_hash text NOT NULL,
 party_id integer, party_name text, invoice_number text,
 from_warehouse_id integer, to_warehouse_id integer, from_warehouse_name text, to_warehouse_name text,
 responsible_name text, responsible_phone text, document_date timestamptz NOT NULL DEFAULT now(),
 items jsonb NOT NULL DEFAULT '[]'::jsonb, subtotal bigint NOT NULL DEFAULT 0,
 freight bigint NOT NULL DEFAULT 0, customs bigint NOT NULL DEFAULT 0, total bigint NOT NULL DEFAULT 0,
 paid_amount bigint NOT NULL DEFAULT 0, payment_location text, payment_tracking_number text,
 note text, journal_entry_id integer, payment_journal_entry_id integer, received_journal_entry_id integer,
 created_by integer, received_by integer, received_at timestamptz, receipt_hash text, receipt_note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_documents_created ON inventory_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_documents_invoice ON inventory_documents(invoice_number);
ALTER TABLE inventory_receipts ADD COLUMN IF NOT EXISTS document_id integer REFERENCES inventory_documents(id);
CREATE INDEX IF NOT EXISTS inventory_receipts_document ON inventory_receipts(document_id);
ALTER TABLE inventory_consignment_lots ADD COLUMN IF NOT EXISTS warehouse_id integer REFERENCES inventory_warehouses(id);
CREATE INDEX IF NOT EXISTS inventory_consignment_location ON inventory_consignment_lots(warehouse_id, product_id, variant_id);
INSERT INTO accounts(code,name,level,type,parent_id)
SELECT '1202','کالای در راه بین انبارها','subsidiary','asset',id FROM accounts WHERE code='11'
ON CONFLICT(code) DO NOTHING;
-- Historical single-line receipts remain individually identifiable; no stock is replayed.
INSERT INTO inventory_documents(number,type,status,idempotency_key,payload_hash,party_id,party_name,invoice_number,
 document_date,items,subtotal,freight,customs,total,paid_amount,payment_location,payment_tracking_number,note,journal_entry_id,created_by,created_at)
SELECT r.number,r.type,'posted','legacy-receipt-'||r.id,'legacy',r.party_id,a.name,r.invoice_number,r.created_at,
 jsonb_build_array(jsonb_build_object('productId',r.product_id,'variantId',r.variant_id,'title',p.name_fa||coalesce(' · '||v.title,''),'sku',coalesce(v.sku,p.sku),'unit',coalesce(v.inventory_unit,p.inventory_base_unit),'quantity',r.quantity,'unitCost',r.unit_cost,'freight',r.freight,'customs',r.customs,'total',r.total)),
 r.quantity*r.unit_cost,r.freight,r.customs,r.total,r.paid_amount,r.payment_location,r.payment_tracking_number,r.note,r.journal_entry_id,r.user_id,r.created_at
FROM inventory_receipts r JOIN products p ON p.id=r.product_id LEFT JOIN product_variants v ON v.id=r.variant_id LEFT JOIN inventory_parties a ON a.id=r.party_id
ON CONFLICT DO NOTHING;
UPDATE inventory_receipts r SET document_id=d.id FROM inventory_documents d WHERE d.idempotency_key='legacy-receipt-'||r.id AND r.document_id IS NULL;
INSERT INTO inventory_documents(number,type,status,idempotency_key,payload_hash,from_warehouse_id,to_warehouse_id,from_warehouse_name,to_warehouse_name,responsible_name,document_date,items,note,created_by,received_by,received_at,created_at)
SELECT 'WT-OLD-'||t.id,'transfer','received','legacy-transfer-'||t.id,'legacy',t.from_warehouse_id,t.to_warehouse_id,f.name,w.name,coalesce(u.name,'ثبت قدیمی'),t.created_at,
 jsonb_build_array(jsonb_build_object('productId',t.product_id,'variantId',t.variant_id,'title',p.name_fa||coalesce(' · '||v.title,''),'sku',coalesce(v.sku,p.sku),'unit',coalesce(v.inventory_unit,p.inventory_base_unit),'quantity',t.quantity,'unitCost',0,'freight',0,'customs',0,'total',0,'receivedQuantity',t.quantity,'acceptedQuantity',t.quantity)),
 t.note,t.user_id,t.user_id,t.created_at,t.created_at FROM inventory_warehouse_transfers t JOIN products p ON p.id=t.product_id LEFT JOIN product_variants v ON v.id=t.variant_id JOIN inventory_warehouses f ON f.id=t.from_warehouse_id JOIN inventory_warehouses w ON w.id=t.to_warehouse_id LEFT JOIN users u ON u.id=t.user_id
ON CONFLICT DO NOTHING;
