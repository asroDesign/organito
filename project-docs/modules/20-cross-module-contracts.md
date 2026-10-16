# قراردادهای بین‌ماژولی

این سند مرزهایی را ثبت می‌کند که با تغییر یک ماژول روی چند بخش دیگر اثر می‌گذارند. هر تغییر باید مالک دادهٔ مرجع را روشن کند و باقی نمایش‌ها/دفترها را از همان منبع تغذیه کند.

## محصول ← قیمت ← سبد ← سفارش

`products` هویت کاتالوگ را می‌دهد؛ `product_variants` شکل قابل سفارش/واحد/قیمت اصلی و `seller_offers` پیشنهاد مستقل فروشنده را می‌دهد. صفحهٔ محصول قیمت نمایشی را از catalog resolver می‌گیرد؛ quote و ثبت سفارش دوباره سرور را مرجع قرار می‌دهند. بعد از ثبت، اقلام، عنوان، variant، قیمت، تخفیف و واحد باید در order snapshot باشند تا تغییر کاتالوگ فاکتور قبلی را عوض نکند.

**نباید:** از قیمت DOM/client، کمترین قیمت خارج از stock policy یا variant حذف‌شده برای سفارش استفاده شود.

## موجودی ← انبار ← فروش/ارسال ← مرجوعی

برای انبار مرکزی، `inventory_warehouse_stock` و movement/document مسیر چندانباره را نگه می‌دارند؛ مدل قدیمی محصول/variant و offer seller همچنان در برخی مسیرها زنده است. POS مرکزی، فروش آنلاین و انتقال حواله باید دقیقاً انبار/variant مورد استفاده را معلوم کنند. مرجوعی وضعیت مالی و فیزیکی جدا دارد: مبلغ refund لزوماً به معنی برگشت کالای قابل فروش نیست.

**نیاز به تثبیت:** در هر مسیر کدام storage مرجع موجودی است؛ چه زمانی رزرو تبدیل به خروجی می‌شود؛ و کالای مرجوعی در چه شرایطی به موجودی آزاد برمی‌گردد.

## Order ← payment ← accounting ← wallet

`orders` وضعیت خرید و snapshot؛ `payments` درخواست/نتیجه پول؛ `journal_entries/lines` دفتر دوبل؛ wallet ledgerها اعتبار قابل مصرف را نشان می‌دهند. این‌ها جایگزین یکدیگر نیستند. یک callback نباید خودش به‌تنهایی paid status معتبر بسازد؛ verify provider و idempotency مقدم‌اند. هر رویداد مالی باید reference قابل ردیابی بین این لایه‌ها داشته باشد.

## موجودی مشتری، امتیاز و معرفی

کیف پول حساب‌محور، اعتبار قدیمی phone-based، امتیاز وفاداری، referral award و affiliate earning دارایی/دفترهای متفاوت‌اند. اگر UI مقدار کلی «اعتبار» را جمع می‌کند، باید دقیقاً مشخص باشد کدام ledger قابل خرج است و تبدیل هر منبع چه رویدادی تولید می‌کند. امتیاز قابل خرج پول نیست تا زمانی که تبدیل اتمی و نرخ تبدیل snapshot نشده باشد.

## ارسال prepaid و پس‌کرایه

carrier/rate انتخاب‌شده بخشی از quote و order snapshot است. prepaid در total پرداخت‌شدهٔ مشتری می‌آید. پس‌کرایه در پرداخت آنلاین/فاکتور صفر می‌شود، اما نوع ارسال و carrier در shipment، invoice و label حفظ می‌شود. تغییر تعرفه پس از ثبت سفارش نباید snapshot سفارش را بازنویسی کند.

## محتوا، home builder، shortcode و media

مقاله، صفحهٔ مستقل، صفحهٔ خانه، فوتر و منو renderer و lifecycle جدا دارند؛ از اشتراک UI، ذخیره‌سازی مشترک بدون قرارداد نسازید. همه می‌توانند به media reference و shortcode تکیه کنند. حذف media یا shortcode باید references را بررسی کند. Public content cache، SEO metadata، sitemap و frontend renderer باید در mutation هماهنگ invalidate شوند.

## تنظیمات و runtime

`settings` بسیاری از مقادیر عمومی را نگه می‌دارد اما داده‌های دامنه در جدول اختصاصی خودشان‌اند. نام سایت، logo، ارز، host canonical، رنگ، provider فعال و feature flags باید از accessor مرکزی بخوانند. سرور نباید secret را به client ارسال کند. بعضی زمان‌بندی‌ها درون process اجرا می‌شوند؛ چند PM2 instance می‌تواند job تکراری بسازد مگر lock/dedupe توزیع‌شده داشته باشد.

## Analytics و attribution

analytics event، session و order attribution با هدف‌های متفاوت ذخیره می‌شوند. رویداد خام برای شمارش event و session متمایز برای نرخ/قیف است. source/referrer باید هنگام ورود/order ایجاد snapshot شود؛ analytics بعدی نباید attribution گذشته را تغییر دهد. IP و user-agent دادهٔ حساس‌اند و دسترسی/retention نیاز به سیاست دارند.

## ماتریس وابستگی و مالک تغییر

| تغییر | ماژول‌هایی که باید دوباره بررسی شوند |
|---|---|
| قیمت یا تنوع | کاتالوگ، shop، cart quote، سفارش، POS، تخفیف، history، بارکد |
| موجودی/رزرو | کاتالوگ، انبار، order، seller offer، POS، ارسال، مرجوعی، analytics |
| درگاه/پرداخت | تنظیمات، cart، order، callback، wallet، accounting، logs |
| آدرس/هزینه ارسال | پروفایل، cart، carrier، order snapshot، POS، invoice، label |
| امتیاز/اعتبار | خرید، profile، wallet، CRM، return/refund، reports، accounting |
| article/page/media | پنل محتوا، frontend، SEO، sitemap، cache، media retention |
| role/permission | menu، page guard، API guard، export، audit |

## Definition of Done مشترک

تغییر بین‌ماژولی زمانی آماده است که migration افزایشی، handler/permission، تراکنش/idempotency، cache invalidation، log/audit، UI در light/dark و mobile، چاپ/export در صورت وجود، و معیارهای پذیرش مربوطه همه بررسی شده باشند. برای تغییرات مالی/موجودی، بررسی هم‌زمان و rollback/idempotency از ظاهر UI مهم‌تر است.
