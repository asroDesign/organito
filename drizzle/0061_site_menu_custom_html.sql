-- Supports sanitized rich HTML content in navigation items.
ALTER TABLE site_menu_items ADD COLUMN IF NOT EXISTS custom_html text;
