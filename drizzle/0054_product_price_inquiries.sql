-- Phone-based price and stock inquiries. Existing product and order data stays intact.
ALTER TABLE products ADD COLUMN IF NOT EXISTS inquiry_only boolean NOT NULL DEFAULT false;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS inquiry_only boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS product_inquiries (
  id serial PRIMARY KEY,
  number text NOT NULL UNIQUE,
  product_id integer NOT NULL REFERENCES products(id),
  variant_id integer REFERENCES product_variants(id),
  user_id integer REFERENCES users(id),
  customer_name text NOT NULL,
  phone text NOT NULL,
  message text,
  consent_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed', 'converted')),
  assigned_to integer REFERENCES users(id),
  internal_note text,
  converted_order_id integer REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_inquiries_status_created ON product_inquiries(status, created_at);
CREATE INDEX IF NOT EXISTS product_inquiries_product_created ON product_inquiries(product_id, created_at);
CREATE INDEX IF NOT EXISTS product_inquiries_phone_created ON product_inquiries(phone, created_at);
