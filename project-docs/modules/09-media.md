# مرکز فایل و رسانه

## معماری ذخیره‌سازی

مدل `media` metadata (filename, alt, MIME, size, folderId, uploadedBy, public/private, storage path/external URL, processing status) نگه می‌دارد؛ باینری در دیتابیس ذخیره نمی‌شود. فایل‌ها در filesystem از طریق `src/lib/media-storage.ts` نوشته/خوانده می‌شوند. `media_folders` دسته‌بندی؛ `media_variants` خروجی‌های مشتق‌شدهٔ بهینه‌سازی تصویر را نگه می‌دارد.

## API و UI

- Upload/download/library: `src/lib/api/public.ts` (`media`, `media/:id`, `media/library`, `media/folders`).
- مدیریت پوشه، metadata، حذف و پردازش: `src/lib/api/media-library.ts`; صفحه `/admin/media` و `MediaLibraryClient`.
- `ImageUploader` انتخاب از مرکز، بارگذاری داخل modal، folder destination، ویرایش/برش چرخشی و ذخیره نسخه جدید را پشتیبانی می‌کند.
- پوشه‌های هدف قراردادی: `blog`, `products`, `custom`; آپلود در محتوای blog و product folder را تعیین می‌کند. API می‌تواند پوشهٔ استاندارد مفقود را با lock بسازد.
- `src/lib/media-processing.ts` و `src/lib/watermark.ts` برای تبدیل/واترمارک؛ `Img` در `src/components/ui` ابعاد/نمایش بهینه را می‌سازد.

## امنیت و lifecycle

Upload با magic bytes/MIME/حد اندازه کنترل می‌شود؛ مسیر ذخیره باید از traversal جدا باشد. `isPublic` تعیین دسترسی رسانه است و media route ممکن است با استفاده در محصول/مقاله هم public شود. حذف باید ارتباط با محصول، blog، avatar، SEO و نسخه‌ها را بررسی کند.

## ریسک‌ها

- filesystem محلی در deployment چند instance خودبه‌خود مشترک نیست؛ production نیازمند volume پایدار/مشترک یا object storage و backup هماهنگ metadata است.
- حذف فایل قبل از پاک‌سازی reference می‌تواند تصویر شکسته بسازد؛ حذف نرم یا شمارش reference امن‌تر است.
- نسخه‌های پردازش‌شده و فایل اصلی باید retention/cleanup سیاست‌مند داشته باشند.
- جست‌وجو و فیلتر folder باید server-side باشد و انتخاب چند تصویر در modal تا دکمهٔ ثبت staged بماند.
- محدودیت مجوز: کاربر RFQ نباید کتابخانهٔ کامل سایت را ببیند؛ endpoint، نه فقط UI، باید ownership/permission فیلتر کند.

## گردش فایل

بارگذاری از فرم معمولی یا modal انتخاب مرکز فایل باید با پوشهٔ مقصد و اعتبارسنجی سمت سرور آغاز شود. در modal، کلیک روی thumbnail فقط selection موقت است؛ دکمهٔ «ثبت» انتخاب نهایی را به فرم برمی‌گرداند. ویرایش تصویر باید نسخهٔ جدید بسازد یا فایل جایگزین را به‌شکل قابل بازیابی ثبت کند و metadata فایل (MIME/اندازه/ابعاد/alt/folder) با باینری sync بماند.

هر reference (تصویر محصول، تصویر شاخص مقاله، avatar، SEO image) شناسهٔ media یا مسیر امن پایدار دارد. فایل عمومی قابل دریافت است؛ فایل خصوصی باید از مسیر authorization-checked سرو شود. مسیر ذخیره باید normalize شود و هیچ filename ورودی اجازهٔ خروج از root storage را نداشته باشد.

## معیارهای پذیرش

- تصویر با MIME جعلی یا فرمت/اندازهٔ ممنوع رد شود؛ نام فایل اصلی برای path استفادهٔ مستقیم نشود.
- folder `blog`, `products` و `custom` در صورت نیاز ساخته شود و انتخاب پوشهٔ مقصد به فرم ذخیره شود.
- cancel کردن modal selection یا upload ناموفق reference فرم را تغییر ندهد.
- حذف media مورد استفاده، یا block شود یا قبل از حذف referenceها و thumbnailها به‌درستی پاک/جایگزین شوند.
- نمایش تصویر دارای width/height یا نسبت ابعاد رزروشده باشد تا layout shift کم شود؛ نسخهٔ بهینه‌شده fallback به فایل اصلی داشته باشد.
