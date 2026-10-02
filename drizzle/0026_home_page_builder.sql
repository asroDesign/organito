INSERT INTO content_pages (title, slug, template, summary, blocks, meta_title, meta_description, status)
VALUES ('صفحه‌ساز صفحه اصلی', 'home', 'nature', 'بخش‌های قابل ویرایش صفحه اصلی فروشگاه', '[]'::jsonb, NULL, NULL, 'published')
ON CONFLICT (slug) DO NOTHING;
