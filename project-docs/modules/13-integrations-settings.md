# تنظیمات و اتصال‌دهنده‌ها

## تنظیمات عمومی

`settings` key/value منبع تنظیمات نام/لوگو/URL/واحد پول، SEO، appearance، gateway، SMS، loyalty، labels/invoice و feature flagهاست. accessor در `src/lib/settings.ts`. UI عمدتاً `/admin/settings`, `/admin/payment-gateways`, `/admin/sms`, `/admin/appearance`, `/admin/labels`, `/admin/carriers` و صفحات تنظیمات دامنه‌ای است. secretها باید ماسک شوند و در audit/response بازنگردند.

## پرداخت

Adapter/service در `src/lib/services/gateway.ts`; API آغاز/callback در `src/lib/api/gateway.ts`; پرداخت دستی و تأیید رسید در `payments.ts`. روش‌های کارت‌به‌کارت/حواله باید flag مستقل داشته باشند. ترب‌پی/اسنپ‌پی/اعتبارسنجی eligibility را از مسیرهای `/payments/*/eligible` و خود callback بخوانید.

## پیامک

`src/lib/sms.ts` provider selection، direct/pattern send و log را ارائه می‌کند. پیکربندی providerها در settings، پنل `/admin/sms`; فروشنده برای club settings خودش دارد. contract pattern: پارامترها باید به نام/ترتیب template provider تبدیل شوند؛ `url` لینک بدون base و `link` آدرس کامل طبق نیاز پروژه.

## ارسال و دریافت حضوری

`carriers`, `carrier_rates`, `pickup_centers`؛ API در `marketing.ts`, `pickup.ts`; فرانت `/admin/carriers`, `/admin/pickup-centers`, cart و POS. نرخ پس‌کرایه یک گزینهٔ carrier مستقل از وزن/شهر است و هزینه در invoice صفر می‌شود؛ label باید عبارت پس‌کرایه داشته باشد.

## نرخ ارز و import

`fx_rates`, `fx_product_prices`; `/admin/fx-pricing` برای preview/apply نرخ؛ API `fx-pricing.ts`. Import محصول دیجی‌کالا در `product-import.ts`, `/admin/products/import` است.

## تنظیم/افزودن integration

1. config type و secret masking را تعریف کنید.
2. service adapter را با timeout، error normalization و idempotency بسازید.
3. route با permission و audit اضافه کنید.
4. test/sandbox/test-connection و status diagnostics در UI ایجاد کنید.
5. log پاسخ را redact کنید.
6. migration و سند را اضافه کنید.

## ریسک

- تنظیمات key/value نوع ایستا و migration-level versioning ندارد؛ نام keyها و defaultها contractند.
- provider SMS/payment ممکن است status مشابه ولی semantics متفاوت داشته باشد؛ normalize در service لازم است.
- بازگشت درگاه باید base URL فعال را از تنظیمات/host allowlist معتبر بسازد و localhost را برای production استفاده نکند.

## قرارداد تنظیمات و تشخیص خطا

تنظیمات عمومی باید یک accessor سروری و یک DTO امن برای نمایش در کلاینت داشته باشند. secretهایی مثل merchant/API key فقط در write API دریافت می‌شوند؛ read API تنها مقدار ماسک‌شده/وجود داشتن secret را برمی‌گرداند. غیرفعال‌کردن provider نباید رکورد تراکنش‌های قبلی را حذف کند.

درگاه‌ها هم‌زمان می‌توانند فعال باشند. checkout فهرست درگاه‌های «فعال و واجد شرایط برای این مبلغ/نوع سفارش/حساب» را از سرور دریافت می‌کند و انتخاب کاربر را به شروع پرداخت می‌فرستد؛ در صورت unavailable بودن، دلیل قابل نمایش داشته باشد. لوگو/icon هر درگاه باید با safe media URL در checkout نمایش داده شود.

برای SMS، تنظیم ارسال مستقیم و template/pattern از هم جداست: provider، API key، template ID، sender/mobile و mapping متغیرهای هر use case باید مشخص شود. خطای provider در log با status/code sanitized ذخیره شود؛ payload حاوی OTP یا secret نباید ثبت شود.

## معیارهای پذیرش

- تغییر gateway پیش‌فرض بدون deploy، در checkout بعدی دیده شود؛ چند gateway فعال به‌صورت انتخابی نشان داده شوند.
- انتخاب provider غیرفعال/غیرمجاز با API دستی ممکن نباشد.
- تنظیمات provider با مقدار secret خالی، secret قبلی را ناخواسته پاک نکند مگر کاربر عملیات پاک‌سازی صریح انجام دهد.
- تست اتصال/ارسال نمونه وضعیت موفق، timeout و پاسخ خطادار را از هم تفکیک کند.
- base URL callback فقط HTTPS و host مجاز production باشد؛ لینک localhost در سفارش production ساخته نشود.
