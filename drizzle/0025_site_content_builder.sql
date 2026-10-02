CREATE TABLE IF NOT EXISTS content_pages (
  id serial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  template text NOT NULL DEFAULT 'nature',
  summary text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta_title text,
  meta_description text,
  status text NOT NULL DEFAULT 'draft',
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_pages_status ON content_pages(status);

CREATE TABLE IF NOT EXISTS footer_links (
  id serial PRIMARY KEY,
  group_title text NOT NULL DEFAULT 'دسترسی سریع',
  label text NOT NULL,
  href text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS footer_links_order ON footer_links(enabled, sort_order);

INSERT INTO content_pages (title, slug, template, summary, blocks, meta_title, meta_description, status) VALUES
('درباره ما', 'about', 'nature', 'درباره فروشگاه و ارزش‌های ما', '[{"type":"hero","title":"درباره {{siteName}}","body":"{{siteName}} پلتفرمی تخصصی برای خرید، استعلام و تأمین محصولات ارگانیک است که انبار مرکزی و ده‌ها تأمین‌کننده معتبر را در یک بستر امن، با پرداخت امانی و آزادسازی وجه پس از تحویل، گرد هم آورده است."},{"type":"features","title":"آنچه برای شما فراهم کرده‌ایم","items":[{"title":"تضمین اصالت","body":"هر محصول با برچسب اصالت (ارگانیک گواهی‌شده / طبیعی / محلی) و بررسی تخصصی کارشناسان عرضه می‌شود."},{"title":"مارکت‌پلیس چندفروشنده","body":"مقایسه قیمت، زمان آماده‌سازی و ضمانت چند تأمین‌کننده برای یک محصول."},{"title":"ارسال مستقل و شفاف","body":"هر فروشنده مرسوله و کد رهگیری جداگانه دارد."},{"title":"تأمین محصولات کمیاب","body":"با کد محصول، نام یا تصویر، محصول مورد نیازتان را برایتان پیدا می‌کنیم."}]}]'::jsonb, 'درباره ما | {{siteName}}', 'با فروشگاه {{siteName}} و تعهد ما به عرضه محصولات ارگانیک و طبیعی آشنا شوید.', 'published'),
('تماس با ما', 'contact', 'contact', 'راه‌های ارتباط با پشتیبانی {{siteName}}', '[{"type":"hero","title":"تماس با ما","body":"برای پیگیری سفارش، مشاوره یا امور مالی با ما در ارتباط باشید. کارشناسان پشتیبانی پاسخگوی شما هستند."},{"type":"cta","title":"پشتیبانی آنلاین","body":"برای پیگیری سفارش یا دریافت راهنمایی، تیکت ثبت کنید تا درخواست شما به واحد مربوطه ارجاع شود.","buttonLabel":"ثبت تیکت پشتیبانی","href":"/customer/tickets"}]'::jsonb, 'تماس با ما | {{siteName}}', 'راه‌های تماس با پشتیبانی فروشگاه {{siteName}}.', 'published')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO footer_links (group_title, label, href, sort_order) VALUES
('دسترسی سریع', 'فروشگاه', '/shop', 10),
('دسترسی سریع', 'مجله {{siteName}}', '/blog', 20),
('دسترسی سریع', 'استعلام کد محصول', '/customer/supply', 30),
('دسترسی سریع', 'تولیدکننده شوید', '/login?seller=1', 40),
('دسترسی سریع', 'سبد خرید', '/cart', 50),
('راهنما', 'درباره ما', '/about', 10),
('راهنما', 'سؤالات متداول', '/faq', 20),
('راهنما', 'تماس با ما', '/contact', 30),
('راهنما', 'ثبت تیکت پشتیبانی', '/customer/tickets', 40)
ON CONFLICT DO NOTHING;
