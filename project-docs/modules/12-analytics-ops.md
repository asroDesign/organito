# تحلیل، داشبورد، ممیزی و سلامت

## تحلیل بازدید و funnel

`analytics_events` eventName/sessionId/userId/productId/orderId/path/source/referrer/UTM/metadata و زمان را نگه می‌دارد. مسیر ورودی `src/lib/api/analytics.ts`; cookie/session منبع نشست در `src/lib/analytics.ts`. رویدادهای محصول همچنین در `product_view_logs` (IP/UA برای گزارش ادمین) و `product_view_presence` (heartbeat نشست‌های آنلاین) ثبت می‌شوند. گزارش admin `/admin/analytics`; سفارش `analyticsSessionId` و `attribution` snapshot می‌کند.

محاسبات funnel باید بر پایه نشست یکتا باشند، نه تعداد event خام: page/product view در سطح session+entity یکتا شود؛ add-to-cart نشست یکتا و buyer نشست دارای order معتبر باشد. بازدیدهای روزانه نیز unique session باید باشند. قبل از تغییر گزارش، پنجره زمانی، timezone، bot/internal traffic و حذف eventهای تکراری مشخص شود.

## داشبورد و عملیات

`/admin` آمارهای سفارش، فروشنده، ticket، برداشت، inquiry، campaign و top products را نمایش می‌دهد. لینک هر کارت باید به فهرست/جزئیات مربوط منتهی شود. `/admin/audit` از `auditLogs` و `/admin/integrity` از route integrity برای ردگیری/سلامت استفاده می‌کند.

## Audit

`src/lib/audit.ts` ورودی action، entity، user، metadata قبل/بعد و درخواست را ثبت می‌کند. دادهٔ حساس/secret نباید در JSON audit باشد. برای mutation مالی یا permission، audit بخشی از definition of done است.

## Cache و background work

`public-cache`, `public-content-cache` خروجی catalog/content/brand را cache می‌کنند؛ invalidate در API router بعضی prefixها را دارد. محصول view ثبت را با `after()` از پاسخ درخواست جدا می‌کند. سفارش‌های stale در catch-all API با `expireStaleOrders()` fire-and-forget آغاز می‌شوند. سلامت گزارش موجودی در `src/lib/services/warehouse-stock-report.ts`، همگام‌سازی سطح وفاداری در `src/lib/services/loyalty-tiers.ts` و رویداد/ارسال هشدار محصول در `src/lib/services/product-alerts.ts` متمرکز است.

## ریسک

- analytics event logging و گزارش funnel اگر session cookie یا event naming متفاوت باشد آمارها ناهمخوان می‌شوند؛ event contract باید مرکزی باشد.
- schedulerهای درون-process برای multi-instance قابل اتکا نیستند؛ jobهای SMS/automation/expiry باید قفل توزیع‌شده، retry و dead-letter داشته باشند.
- IP دادهٔ حساس است؛ retention و دسترسی log محصول باید admin-only و محدود باشد.
- top product query باید بازه/معیار (بازدید/تعداد فروش/درآمد) را در UI صریح کند.

## تعریف شاخص‌ها

- `event count`: تعداد رویداد خام؛ برای تحلیل فنی مفید است اما معادل تعداد کاربر/نشست نیست.
- `unique sessions`: تعداد شناسهٔ نشست متمایز در پنجرهٔ گزارش؛ بازدید چندبارهٔ همان محصول در یک نشست برای KPI یکتای مشاهدهٔ محصول یک‌بار حساب می‌شود.
- `sessions with cart`: نشست‌هایی که حداقل یک event افزودن به سبد معتبر دارند؛ حذف event به دلیل dedupe نباید از معیار raw event مخفی شود.
- `buyer sessions`: نشست‌هایی که به سفارش معتبر/پرداختی طبق تعریف محصول رسیده‌اند؛ pending/failed payment باید از این معیار تفکیک شود.
- بازدید روزانه با timezone انتخابی گزارش group می‌شود. همهٔ کارت‌ها/نمودارها باید یک بازه، timezone و فیلتر bot/internal مشترک داشته باشند.

## معیارهای پذیرش

- صفحه‌دیدن یک محصول دو بار در یک session، raw events را دو نشان دهد اما unique product views را یک.
- افزودن به سبدهای تکراری در یک session فقط یک نشست دارای سبد بسازد؛ تعداد event خام جدا نمایش داده شود.
- روز گزارش در timezone پروژه مرزبندی شود و بازهٔ انتخاب‌شده در query همهٔ نمودارها یکسان اعمال گردد.
- سفارش بدون payment success، در KPI خریدار فقط بر اساس تعریف مورد تأیید ظاهر شود؛ تعریف این KPI باید در UI توضیح داده شود.
- کارت dashboard لینک به همان فیلتر یا entity متناظر برود؛ نمودار top products معیار مرتب‌سازی و بازه را شفاف کند.
