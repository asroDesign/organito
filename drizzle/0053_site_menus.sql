-- Multi-placement public menus. Existing footer links remain in place and are copied into the new menu.
CREATE TABLE IF NOT EXISTS site_menus (
  id serial PRIMARY KEY,
  placement text NOT NULL UNIQUE CHECK (placement IN ('header', 'footer', 'mobile')),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_menu_items (
  id serial PRIMARY KEY,
  menu_id integer NOT NULL REFERENCES site_menus(id) ON DELETE CASCADE,
  parent_id integer,
  label text NOT NULL,
  href text,
  group_title text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  target_blank boolean NOT NULL DEFAULT false,
  legacy_footer_link_id integer UNIQUE,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_menu_items_order ON site_menu_items(menu_id, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS site_menu_items_deleted_at ON site_menu_items(deleted_at);
INSERT INTO site_menus (placement, name) VALUES
  ('header', 'منوی اصلی هدر'), ('footer', 'منوی فوتر'), ('mobile', 'منوی موبایل')
ON CONFLICT (placement) DO NOTHING;
INSERT INTO site_menu_items (menu_id, label, href, group_title, sort_order, enabled, legacy_footer_link_id)
SELECT m.id, f.label, f.href, f.group_title, f.sort_order, f.enabled, f.id
FROM footer_links f JOIN site_menus m ON m.placement = 'footer'
ON CONFLICT (legacy_footer_link_id) DO NOTHING;
