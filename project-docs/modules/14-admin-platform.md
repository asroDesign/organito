# پنل مدیریت، کاربران، دسترسی و به‌روزرسانی

## پنل

Admin layout در `src/app/admin/layout.tsx`; dashboard `/admin`; صفحات کاربران/نقش‌ها `/admin/users`, `/admin/access`; تنظیمات، ممیزی، زباله‌دان، updates و زیرماژول‌های دیگر در `/admin/*`. منو را از `src/components/Shell.tsx`/navigation و permission map هماهنگ کنید.

## RBAC و کاربران

`users` هویت و نقش پایه، `access_roles` permissions سفارشی؛ user `extraPermissions` دارد. `permissionsOf()` union نقش + extra + role سفارشی می‌سازد. `requirePage` دسترسی صفحه، `requireApi` دسترسی mutation/read را enforce می‌کند. API کاربر در `src/lib/api/staff.ts`; access UI در `src/app/admin/access/page.tsx`.

قاعده: user admin با `BLOG_PUBLISH` ممکن است review کند، اما ایجاد/ویرایش محتوا در pageهای فعلی `PRODUCTS_EDIT` می‌خواهد. این تفکیک باید مستند/مقصود باشد؛ افزودن permission blog edit مستقل می‌تواند به design change نیاز داشته باشد.

## زباله‌دان و حذف

`trash.ts` حذف‌های پشتیبانی‌شده را restore می‌کند. بسیاری از entityهای حیاتی `deletedAt` دارند؛ دادهٔ مالی/سفارش بهتر است با reversal/status تغییر کند نه delete. هر entity حذف‌پذیر باید restoration کامل و unique conflict handling داشته باشد.

## به‌روزرسانی

پنل `/admin/updates`; upload package handler `/api/admin/updates`; ابزارهای `scripts/create-update-package.mjs`, `scripts/apply-update.mjs`, `scripts/generate-update-keys.mjs`; عملیات runtime از PM2/deployment config. signed package/public key، backup (`pg_dump`) و restart باید با خطای قابل بازیابی و گزارش واضح اجرا شود. کلید خصوصی نباید در مخزن باشد.

## عملیات چاپ

Routes `/print/*` برای invoice، shipping label، journal cover, warehouse document/stock و barcodeها؛ layout مستقل print. تغییر قالب باید هم preview admin و هم خروجی واقعی browser print را حفظ کند.

## ریسک

- دسترسی هر دو لایهٔ UI/API لازم است؛ role سفارشی را در test با endpoint مستقیم بررسی کنید.
- updater توان اجرای کد deploy دارد؛ verify امضا، path traversal، archive bomb، backup و rollback الزامی‌اند.
- فایل‌های چاپ حساس‌اند؛ route باید owner/permission را validate کند.

## کنترل دسترسی و عملیات حساس

هر قابلیت پنل باید نام permission، نقش‌های پیش‌فرض، مسیر صفحه و handlerهای API مرتبط را مشخص کند. Page guard UX/ناوبری را کنترل می‌کند؛ API guard کنترل امنیتی قطعی است. فهرست‌کردن، export، جزئیات و mutation ممکن است مجوزهای متفاوت بخواهند. هنگام تغییر منوی پنل، permission filter و mobile navigation با هم به‌روز شوند.

ویرایش کاربر باید تغییر نقش، فعال/غیرفعال، گروه، پروفایل و reset/revoke نشست را از هم تفکیک کند. تغییرات نقش/مجوز یا عملیات updater باید در audit ثبت شود. پاسخ API برای کاربر غیرمجاز باید اطلاعات حساس entity را لو ندهد.

## معیارهای پذیرش

- role بدون permission، با واردکردن مستقیم URL یا فراخوانی endpoint، نتواند عملیات را اجرا کند.
- export همان authorization و filterهای فهرست را اعمال کند و دادهٔ خارج از scope را افشا نکند.
- عملیات soft-delete قابل restore باشد و restore در صورت برخورد unique conflict پیام actionable بدهد.
- updater قبل از اعمال، امضای بسته و pathهای archive را بررسی کند؛ backup/عدم موفقیت/rollback وضعیت قابل مشاهده داشته باشند.
- navigation در موبایل تمام مقصدهای مجاز، از جمله خروج از حساب، را نمایش دهد و روی صفحهٔ فعلی overlay نماند.
