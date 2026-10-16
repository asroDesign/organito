# محتوا، وبلاگ و طراحی صفحات

## وبلاگ

پنل `/admin/blog`, edit/new, taxonomy و SEO؛ فرانت `/blog`, `/blog/[slug]`, `/blog/tag/[slug]`. مدل `blog_posts` شامل عنوان/slug/excerpt/content، تصویر cover و SEO، category/tags، contentType (text/video/audio)، media idها، وضعیت draft/in_review/published، review note و نویسنده است. taxonomy در `blog_categories`, `blog_tags`. API در `src/lib/api/content.ts`; صفحه‌های عمومی از `src/lib/public-content-cache.ts` و `seoMetadata` استفاده می‌کنند.

## صفحات ثابت و builder

`content_pages` قالب، slug، summary، block JSON، metadata و status را دارد؛ revisionها در `content_page_revisions`. صفحات `/about`, `/contact`, `/terms`, `/pages/[slug]` و پنل `/admin/site-content`. `src/lib/page-builder.ts` بلوک‌ها را normalize می‌کند. خانه‌ساز در `/admin/home-builder`, preview و `home_builder_state`، سکشن‌ها و دادهٔ صفحه اصلی را مدیریت می‌کند.

## ناوبری و فوتر

`site_menus`, `site_menu_items` برای ساختار منو، ترتیب/والد و نوع محتوا/HTML؛ `footer_links` برای پیوندهای legacy؛ `footer-builder` state در settings/API مدیریت می‌شود. مصرف‌کنندگان فرانت در `SiteHeader`, `SiteFooter`, `src/lib/site-menus.ts` را بررسی کنید.

## فرم عمومی و داستانک

`public_forms`, `public_form_submissions`; builder/validation و export در `src/lib/api/forms.ts`. `stories`, `story_interactions` برای storyهای کوتاه و تعامل.

## SEO

SEO شامل تنظیمات صفحهٔ عمومی/blog، per-category/tag، product SEO و social metadata است. sitemap در `src/app/sitemap.ts` و robots در `src/app/robots.ts` تولید می‌شوند؛ متادیتا باید از `generateMetadata`/layout ساخته شود تا در `<head>` قرار بگیرد.

## نقاط قوت و ریسک

- بلوک صفحه در JSON گسترش‌پذیر است، اما schema نوع‌دار/نسخه‌دار آن contract حیاتی است؛ unknown block را graceful مدیریت کنید.
- HTML سفارشی و shortcodeها سطح اجرای محتوا دارند؛ sanitize، allowlist و escape در فرانت ضروری است. دادهٔ HTML مدیر را خودکار برای همهٔ نقش‌ها باز نکنید.
- امکان feature overlap بین home builder، content page builder، footer builder و shortcode renderer وجود دارد؛ هرکدام هدف/منبع ذخیرهٔ جدا دارد. قبل از افزودن builder پنجم، قابلیت موجود گسترش یابد.
- کش عمومی برای تغییر مقاله/صفحه/منو باید invalidate شود؛ router فقط بعضی mutation prefixها را پوشش می‌دهد.
- تاریخ انتشار و canonical و SEO image/keywords باید در فهرست و فرانت هماهنگ بمانند.

## چرخهٔ انتشار محتوا

مقاله/صفحه از فرم پنل به API اعتبارسنجی و سپس ذخیره می‌شود. وضعیت پیش‌نویس/بازبینی/انتشار باید در query عمومی enforce شود؛ draft یا صفحهٔ حذف‌شده نباید با دانستن slug عمومی شود. تغییر slug، category، تصویر SEO یا محتوای صفحه باید cache و sitemap را invalidate کند. محتوای بلوکی با نسخهٔ schema رندر می‌شود؛ block ناشناخته باید fallback امن داشته باشد تا یک صفحهٔ قدیمی کل سایت را از دسترس خارج نکند.

در فرانت، metadata در head از مسیرهای Next Metadata API ساخته شود، canonical و robots directive با وضعیت انتشار هماهنگ باشند، تصویر OG اندازه و URL کامل داشته باشد و `sitemap.ts` تنها URLهای canonical/public را منتشر کند. برای محتوای فارسی، title/description، slug و date format نباید به عنوان placeholder باقی بمانند.

## جزئیات اجرایی ماژول وبلاگ

### نقش‌ها و گردش بازبینی

در `/admin/blog` مجوز و scope تعیین می‌کند چه چیزی دیده شود: نویسندهٔ عادی نوشته‌های خودش را می‌بیند/ویرایش می‌کند و می‌تواند draft را ذخیره یا برای بازبینی بفرستد؛ `BLOG_PUBLISH` نوشته‌های در صف را می‌بیند و می‌تواند منتشر یا با یادداشت اجباری برای اصلاح برگرداند. انتشار مستقیم نیازمند مجوز انتشار است. درخواست تغییر، `reviewNote` و وضعیت `in_review`/بازگشت را ثبت می‌کند؛ نوشتهٔ soft-deleted نباید در query عمومی ظاهر شود. مدیر/بازبین به نوشته‌های دیگران دسترسی دارد، اما ویرایش عادی باید مالکیت نویسنده را کنترل کند.

### فیلدهای مقاله و اعتبارسنجی

فرم `BlogPostForm` عنوان، slug، خلاصه، متن rich text، نوع محتوا (متن/ویدیو/صوت)، تصویر شاخص، دسته، چند برچسب، اطلاعات SEO، canonical، کلیدواژه‌ها و تصویر SEO را مدیریت می‌کند. محتوا می‌تواند shortcode داشته باشد. حدود فعلی validation شامل عنوان تا ۱۸۰، خلاصه تا ۵۰۰، محتوای تا ۲۰۰٬۰۰۰ نویسه، حداکثر ۲۰ tag و تا ۳۰ keyword است؛ SEO title حداکثر ۱۶۰ و meta description حداکثر ۳۲۰ نویسه. slug نرمال‌سازی می‌شود. برای انتشار و بازبینی محتوای video/audio، media متناسب با نوع محتوا باید وجود داشته باشد؛ صرف انتخاب نوع رسانه کافی نیست.

تصویر شاخص و تصویر SEO از uploader/مرکز رسانه با پوشهٔ `blog` ذخیره می‌شوند. در انتخاب رسانه باید کاربر دکمهٔ ثبت انتخاب را بزند تا فایل انتخابی در فرم ثبت شود؛ این عملیات با ذخیرهٔ خود مقاله متفاوت است. متن مقاله از editor ذخیره می‌شود؛ renderer shortcodeها باید ورودی را امن parse کند و HTML ناشناس را مستقیم اجرا نکند.

### دسته‌بندی و برچسب

در taxonomy دسته‌ها نام، slug، توضیح، ترتیب و فعال‌بودن دارند. دستهٔ استفاده‌شده در مقاله حذف نمی‌شود؛ تغییر نام باید ارتباط مقاله‌ها را به‌روز نگه دارد. برچسب‌ها از taxonomy مستقل و از برچسب‌های مقاله‌ها قابل مدیریت‌اند؛ برای tag فیلدهای SEO (title، meta، keywords و canonical) وجود دارد. tag استفاده‌شده قابل حذف نیست و rename باید مقدار JSONB برچسب‌های مقاله‌های مرتبط را نیز اصلاح کند. انتخاب دسته/برچسب در فرم مقاله به‌صورت رابطهٔ محتوایی ذخیره می‌شود؛ وجود کلمه در متن به‌تنهایی دسته‌بندی محسوب نمی‌شود.

### SEO وبلاگ و robots

صفحهٔ `/admin/blog/seo` تنظیمات پیش‌فرض و عمومی SEO وبلاگ را نگه می‌دارد: site URL، عنوان/توضیحات/کلمات کلیدی خانه، فروشگاه و blog و تصویر پیش‌فرض OG، به‌علاوهٔ سیاست robots بر اساس user-agent، allow/disallow path و فعال‌بودن sitemap. robots.txt از تنظیمات در `src/app/robots.ts` ساخته می‌شود و sitemap از `src/app/sitemap.ts`; domain/canonical باید از site URL واقعی بیاید، نه `localhost`. تنظیم عمومی، metadata مختص مقاله، دسته و برچسب را جایگزین نمی‌کند؛ فیلدهای هر صفحه باید در اولویت بالاتر اعمال شوند. مقالهٔ منتشرنشده نباید در metadata عمومی، sitemap یا JSON-LD لو برود.

### نمایش فرانت و کش

صفحهٔ فهرست `/blog` و جزئیات `/blog/[slug]` باید تنها نوشتهٔ published و فعال را query کنند؛ صفحات tag/category مسیر جدا دارند. جزئیات مقاله باید تصویر، خلاصه/متن، دسته و tag و SEO متناظر را از همان رکورد بخواند. تغییر status، slug، category/tag، تصویر یا SEO مستلزم invalidation cache و sitemap در همان دامنه است. وبلاگ و صفحه‌ساز سایت چند renderer متفاوت دارند؛ ذخیرهٔ مقاله نباید بدون قرارداد جداگانه به `content_pages` یا home builder کپی شود.

### APIها و مدل‌های داده

API اصلی در `src/lib/api/content.ts` و persistence/اعتبارسنجی در `src/lib/content.ts` است. مدل `blog_posts` متن مقاله و وضعیت review را نگه می‌دارد؛ taxonomy در `blog_categories` و `blog_tags` است؛ category در رکورد مقاله و tagها در دادهٔ مقاله sync می‌شوند. به‌روزرسانی مقاله باید مجوز، نویسنده، slug یکتا، نوع رسانه، مالکیت تصویر و وضعیت publication را در سمت سرور بررسی کند؛ مخفی‌کردن دکمه در UI کنترل دسترسی کافی نیست.

| کار | ورودی/مجوز | نتیجه |
|---|---|---|
| ذخیرهٔ پیش‌نویس | نویسنده مجاز؛ فیلدهای پایه معتبر | `draft`؛ عمومی نمی‌شود |
| ارسال برای بررسی | نویسندهٔ مقاله | `in_review` و قابل مشاهده برای بازبین |
| تأیید انتشار | `BLOG_PUBLISH` | `published`؛ واجد نمایش عمومی و sitemap |
| درخواست اصلاح | `BLOG_PUBLISH` به‌همراه یادداشت | وضعیت بازبینی/اصلاح و پیام به نویسنده |
| حذف مقاله | دسترسی مدیریت محتوای مجاز | soft delete و حذف از query عمومی |
| تغییر taxonomy | نقش مجاز؛ جلوگیری از حذف مورد استفاده | ارتباط مقاله‌ها حفظ/به‌روز می‌شود |

## مواردی که مستند قبلی جا انداخته بود

- تفاوت نویسنده، بازبین و منتشرکننده و وضعیت‌های `draft/in_review/published`؛
- نوع مقالهٔ متن/ویدیو/صوت و الزام رسانهٔ مطابق نوع برای انتشار؛
- محدودیت تعداد tag/keyword و سقف طول فیلدهای مقاله؛
- رفتار حذف/تغییر نام دسته و برچسب‌های مورد استفاده؛
- SEO اختصاصی tag و تنظیم robots در کنار تنظیمات عمومی SEO؛
- ثبت انتخاب رسانه در فرم (select) در برابر ذخیرهٔ نهایی مقاله (save)؛
- اتصال status/slug/metadata به فرانت، cache و sitemap.

## معیارهای پذیرش

- تغییر یا حذف مقاله/صفحه در فرانت، sitemap و cache حداکثر در همان مسیر invalidate شود.
- صفحهٔ درباره، تماس و شرایط استفاده از همان renderer محتوای داینامیک استفاده کند و مدیر بتواند آن را ویرایش کند.
- صفحه‌ساز اجازه دهد container/ستون و آیتم‌هایی مانند تصویر، متن، CTA و shortcode چیده شوند؛ responsive settings باید در viewport واقعی اعمال شوند.
- HTML و کدهای سفارشی فقط در سطح نقش مجاز پذیرفته شوند؛ HTML صفحهٔ عمومی sanitize/allowlist شود و اجرای script محدود به محل تنظیمات مورد اعتماد باشد.
- مقالهٔ منتشرنشده در sitemap/جست‌وجوی عمومی/JSON-LD ظاهر نشود؛ canonical و og:url با دامنهٔ واقعی پیکربندی‌شده باشند.
