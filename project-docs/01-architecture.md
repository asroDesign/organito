# معماری و قراردادهای سراسری

## پشته و مرزهای اصلی

- Next.js App Router، React، TypeScript strict، Tailwind و PostgreSQL/Drizzle.
- صفحه‌ها زیر `src/app/` هستند؛ API اصلی از catch-all در `src/app/api/[...path]/route.ts` عبور می‌کند.
- handlerهای API در `src/lib/api/*.ts` بر اساس دامنه تفکیک شده‌اند و در `src/app/api/[...path]/route.ts` به آرایهٔ مرکزی `routes` اضافه می‌شوند.
- قوانین تجاری تراکنشی عمدتاً در `src/lib/services/` قرار دارند؛ UI نباید منطق مالی/موجودی را مرجع نهایی بداند.
- دسترسی دیتابیس از `src/db/index.ts` و schema از `src/db/schema.ts` است.

## چرخهٔ درخواست API

`GET/POST/PUT/DELETE /api/<path>` → catch-all API → `ensureSeeded()` → اجرای پاک‌سازی سفارش‌های منقضی به‌صورت background → `dispatch(routes, req, path)` → تطبیق route با بیشترین specificity → کنترل CSRF برای متدهای تغییردهنده → اجرای handler → تبدیل خروجی به JSON.

خطاهای `HttpError` با status مشخص به JSON `{error}` تبدیل می‌شوند. خطای یکتا/duplicate به 409 تبدیل می‌شود و خطای ناشناخته 500 عمومی می‌گیرد و در سرور log می‌شود. در بعضی خانواده‌ها router بعد از mutation کش عمومی کاتالوگ/محتوا/برند را invalidate می‌کند؛ دامنهٔ invalidate در `src/lib/api/router.ts` hard-coded است.

## هویت و مجوز

- cookie نشست `yt_sid`، httpOnly، sameSite=lax؛ مقدار ذخیره‌شده در DB digest توکن است، نه توکن خام.
- نشست در `sessions` همراه IP و User-Agent و تاریخ انقضا نگهداری می‌شود.
- `getUser`, `requireApi`, `requirePage` در `src/lib/auth.ts` مرز اصلی احراز هویت‌اند.
- نقش‌ها، مجوزها و نگاشت پایه در `src/lib/rbac.ts`; مجوزهای فردی و role سفارشی از جدول‌های `users` و `access_roles` ترکیب می‌شوند.
- صفحه‌های پنل عموماً در سرور `requirePage` اجرا می‌کنند؛ API باید مجوز را دوباره با `requireApi` کنترل کند.
- CSRF برای APIهای تغییردهنده: هدر `x-csrf: 1` و در صورت وجود Origin تطبیق host.

## دیتابیس و مهاجرت

- تعریف تایپ‌ها/ستون‌ها در `src/db/schema.ts` است.
- فایل‌های SQL افزایشی در `drizzle/NNNN_description.sql` هستند. `scripts/migrate.mjs` فایل‌های مطابق نام‌گذاری را مرتب می‌کند و tag را در `app_migrations` ثبت می‌کند؛ migration اجراشده دوباره اجرا نمی‌شود.
- `drizzle/meta/_journal.json` در این پروژه فهرست کامل اجرای migration را مشخص نمی‌کند؛ برای deploy قرارداد عملی `scripts/migrate.mjs` و `app_migrations` را بررسی کنید.
- `src/db/index.ts` به `DATABASE_URL` نیاز دارد و Pool سراسری را در محیط غیر production reuse می‌کند.
- مدل دسترسی DB با FKهای صریح و cascade در همهٔ جدول‌ها یکنواخت نیست؛ حذف فیزیکی را بدون بررسی ارجاعات انجام ندهید.

## فایل، تنظیمات و cache

- تنظیمات عمومی از `src/lib/settings.ts` و جدول `settings` خوانده می‌شوند.
- رسانه از مدل فایل‌محور استفاده می‌کند؛ برای قرارداد پوشه و پردازش سند [مرکز فایل](modules/09-media.md) را ببینید.
- cacheهای عمومی در `src/lib/public-cache.ts` و `src/lib/public-content-cache.ts` هستند؛ routeهای mutate باید invalidate مناسب داشته باشند.

## اصول امن برای تغییرات بعدی

1. تراکنش‌های موجودی/پرداخت/حسابداری را در یک transaction نگه دارید و ردیف‌های رقابتی را قفل کنید.
2. برای عملیات قابل تکرار idempotency key یا قید یکتا داشته باشید.
3. وضعیت‌های متنی را از مصرف‌کننده‌ها و گزارش‌ها نیز جست‌وجو کنید؛ enum مرکزی واحدی برای همهٔ statusها وجود ندارد.
4. migration باید additive و قابل تکرار باشد؛ دادهٔ قبلی production باید حفظ شود.
5. APIها از `int`, `str`, `HttpError` در `src/lib/util.ts` استفاده می‌کنند؛ اعتبارسنجی دادهٔ ورودی را به UI واگذار نکنید.
6. audit برای عملیات حساس از `src/lib/audit.ts` ثبت می‌شود؛ تغییرات مالی، دسترسی و محتوا باید با کاربر/مرجع/قبل‌و‌بعد قابل ردیابی باشند.

## ضعف‌ها و ریسک‌های قابل پیگیری

- README ریشه با دامنه و معماری فعلی اختلاف‌های بزرگ دارد: عنوان YadakTech/قطعات خودرو، ادعای تعداد ثابت جدول‌ها، ذخیرهٔ media در bytea و فهرست API محدود با کد جاری هم‌راستا نیستند. این پوشه مرجع معماری تازه‌تر است؛ README باید بعداً بازنگری محتوایی شود.
- router با آرایهٔ مرکزی و شرط‌های regex برای cache invalidation رشد کرده؛ افزودن route بدون ثبت در آرایه یا invalidate اشتباه می‌تواند رفتار ظاهراً موفق ولی دادهٔ cache شده ایجاد کند.
- rate limit در حافظهٔ process (`Map`) در چند مسیر استفاده می‌شود و بین چند replica مشترک نیست؛ برای مقیاس چند replica باید rate limit توزیع‌شده جایگزین/تکمیل شود.
- `ensureSeeded()` در مسیر API اجرا می‌شود؛ هزینه و رفتار آن باید در `src/lib/seed.ts` قبل از تغییر استقرار بررسی شود.
