INSERT INTO content_pages (title, slug, template, summary, blocks, meta_title, meta_description, status)
VALUES (
  'صفحه‌ساز صفحه اصلی', 'home', 'nature', 'بخش‌های قابل ویرایش صفحه اصلی فروشگاه',
  '[{"type":"store_section","sectionId":"hero","title":"","body":"","items":[]},{"type":"store_section","sectionId":"trust","title":"","body":"","items":[]},{"type":"store_section","sectionId":"categories","title":"","body":"","items":[]},{"type":"store_section","sectionId":"festival","title":"","body":"","items":[]},{"type":"store_section","sectionId":"deals","title":"","body":"","items":[]},{"type":"store_section","sectionId":"popular","title":"","body":"","items":[]},{"type":"store_section","sectionId":"why","title":"","body":"","items":[]},{"type":"store_section","sectionId":"guarantee","title":"","body":"","items":[]},{"type":"store_section","sectionId":"farms","title":"","body":"","items":[]},{"type":"store_section","sectionId":"fresh","title":"","body":"","items":[]},{"type":"store_section","sectionId":"blog","title":"","body":"","items":[]},{"type":"store_section","sectionId":"testimonials","title":"","body":"","items":[]},{"type":"store_section","sectionId":"promo","title":"","body":"","items":[]}]'::jsonb,
  NULL, NULL, 'published'
)
ON CONFLICT (slug) DO NOTHING;
