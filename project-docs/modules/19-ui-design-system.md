# زبان طراحی و قرارداد رابط کاربری

این سند قواعد مشترک رابط را از CSS و shell فعلی استخراج می‌کند. رنگ و اندازهٔ دقیق هر صفحه باید با اجرای همان صفحه و مقایسهٔ تصویری تأیید شود؛ این سند به‌تنهایی مرجع pixel-perfect نیست.

## پایهٔ فنی و جهت نمایش

- چارچوب Next.js App Router و React؛ رابط RTL و متن فارسی با فونت Vazirmatn است. CSS اصلی `src/app/globals.css` است و Tailwind CSS 4 از `@theme` استفاده می‌کند.
- زبان/جهت باید روی document root تعیین شود؛ inputهای فارسی راست‌چین باشند ولی شناسه‌ها، شماره‌ها، SKU، کد پیگیری و URL در کنترل‌های مناسب LTR یا bidi-isolated نمایش یابند.
- اعداد و تاریخ‌های نمایشی بر اساس قرارداد هر صفحه فارسی‌سازی می‌شوند. تاریخ ماشین/API باید timezone و قالب ISO روشن داشته باشد؛ تاریخ شمسی فقط در مرز UI parse/format شود.
- shellها و navigation در `src/components/Shell.tsx` و layoutهای admin/seller/customer قرار دارند. تغییر navigation باید desktop، mobile، permission filter و خروج از حساب را باهم بررسی کند.

## رنگ و تم

- فونت پیش‌فرض `Vazirmatn` است. پالت اصلی فعلی در CSS با aliasهای `emerald-*` به زرد آفتابی نزدیک شده (`#ffeb3b`, `#fdd835`, `#fbc02d`) تا کلاس‌های قدیمی نیز ظاهر جدید بگیرند.
- `data-palette` شامل `sunshine`, `forest`, `ocean` و `data-theme="dark"` رنگ‌های dark surface/text را کنترل می‌کند. هنگام استفاده از utilityهای Tailwind در صفحات، از overrideهای سراسری آگاه باشید.
- کنترل‌های پایهٔ `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-success`, `.btn-sm`, `.input`, `.skeleton` تعریف شده‌اند. دکمه‌های hover/disabled/focus باید در هر دو تم خوانا بمانند.
- نقاط قوت دیدگاه رنگ سبز، خطا/حذف قرمز، هشدار زرد/کهربایی و موفقیت سبز معنادار است؛ رنگ نباید تنها کانال انتقال وضعیت باشد.
- در dark theme رنگ ثابت inline و editorهای شخص ثالث ممکن است override سراسری را دور بزنند. CKEditor برای dark variables و modal/table hover قواعد جدا دارد.

## layout، فرم و بازخورد

- صفحهٔ پنل معمولاً عنوان/شرح، اقدام اصلی، فیلترها، محتوا و صفحه‌بندی را به ترتیب بصری نشان می‌دهد. فهرست پرحجم باید server-side pagination و query state در URL داشته باشد.
- برای فرم‌های طولانی، بخش‌بندی عنوان‌دار و ترتیب منطقی؛ validation کنار فیلد؛ وضعیت در حال ذخیره؛ و حفظ داده پس از خطا لازم است. مبلغ در input و نمایش باید سه‌رقم‌سه‌رقم جدا شود ولی مقدار ارسالی عدد نرمال باشد.
- حذف، برگشت مالی و تغییرات برگشت‌ناپذیر به تأیید با modal واضح نیاز دارند؛ modal عمومی باید focus management، Escape، scroll داخلی و دکمهٔ قابل دسترسی داشته باشد. کلاس `.modal-scroll-panel` حد ارتفاع/scroll را فراهم می‌کند.
- modal انتخاب محصول/فایل باید search و filter server-side داشته باشد؛ انتخاب موقت تا اقدام «ثبت» با تغییر فرم اصلی یکی نیست.
- editor rich text در `.rich-editor` راست‌چین، Vazirmatn، toolbar wrap و ارتفاع قابل استفاده دارد؛ نمایش HTML ذخیره‌شده در frontend باید امن باشد.

## responsive و دسترس‌پذیری

- موبایل نباید صرفاً نسخهٔ فشردهٔ جدول دسکتاپ باشد؛ جدول‌های عریض می‌توانند scroll افقی کنترل‌شده یا row-card داشته باشند و actions از viewport خارج نشوند.
- sticky summary (مانند فاکتور POS) در desktop باید ارتفاع محدود و scroll داخلی داشته باشد؛ در mobile به جریان عادی صفحه برگردد.
- target لمسی حداقل مناسب، focus ring واضح، label برای input، نام قابل‌خواندن برای icon-only button و ترتیب tab منطقی لازم است.
- انیمیشن، hover و رنگ تنها روش فهمیدن حالت نباشد؛ loading، empty، error، disabled و success باید متن/نشانگر روشن داشته باشند.

## چاپ و تغییر تم

پرینت از تم UI مستقل است: `@media print` زمینهٔ سفید، حذف navigation و حذف shadow را اعمال می‌کند. متن فاکتور/لیبل، اعداد و لوگو باید روی خروجی واقعی browser واضح باشند. dark theme را روی صفحهٔ جزئیات محصول، صفحه‌های مدیریتی، editor، dropdown، hover، dialog و حالت چاپ جداگانه بررسی کنید.

## چک‌لیست پذیرش UI

- viewportهای مرجع: موبایل باریک، تبلت و دسکتاپ؛ zoom مرورگر ۲۰۰٪ برای صفحات و modalهای اصلی.
- themeهای light/dark و paletteهای پشتیبانی‌شده؛ hover/focus/selected/disabled و editor.
- حالت loading، empty، error، موفقیت، دسترسی ردشده، لیست طولانی، متن فارسی بلند و عدم وجود تصویر.
- keyboard-only: باز/بستن modal، جابه‌جایی focus، submit فرم و اجرای چاپ.
- visual regression برای مسیرهای اصلی خرید، محصول، POS، سفارش، مرکز فایل و builderها.
