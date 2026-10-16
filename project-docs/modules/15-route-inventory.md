# فهرست مسیریابی برای جست‌وجوی سریع

این فهرست گروهی است؛ route نهایی را با `find src/app -name page.tsx` و patternهای `src/lib/api/*.ts` بازبینی کنید. API catch-all در `src/app/api/[...path]/route.ts` همهٔ handlerها را route می‌کند. فهرست method/path اعلام‌شده در APIها در [فهرست API](22-api-route-index.md) آمده است.

## فرانت فروشگاه

- `/`, `/shop`, `/categories`, `/brands`, `/brands/[slug]`, `/products/[slug]`, `/cart`, `/compare`, `/blog`, `/blog/[slug]`, `/blog/tag/[slug]`, `/pages/[slug]`, `/about`, `/contact`, `/faq`, `/terms`, `/forms/[slug]`, `/sitemap.xml`, `/robots.txt`.
- `/login`, `/pay/result`, `/pay/simulate/[authority]`, `/orders/[id]`.

## مشتری

`/customer`, `/customer/profile`, `/customer/security`, `/customer/addresses`, `/customer/orders`, `/customer/orders/[id]`, `/customer/tracking`, `/customer/returns`, `/customer/tickets`, `/customer/tickets/[id]`, `/customer/wallet`, `/customer/credit`, `/customer/loyalty`, `/customer/referral`, `/customer/affiliate`, `/customer/favorites`, `/customer/alerts`, `/customer/supply`, `/customer/supply/[id]`.

## فروشنده

`/seller`, `/seller/profile`, `/seller/products`, `/seller/products/new`, `/seller/products/[id]/edit`, `/seller/orders`, `/seller/orders/[id]`, `/seller/pos`, `/seller/pos/invoice/[id]`, `/seller/finance`, `/seller/wallet`, `/seller/returns`, `/seller/rfq`, `/seller/groups`, `/seller/campaigns`, `/seller/automations`, `/seller/loyalty`, `/seller/warehouse-issues`.

## مدیریت

محصول/کاتالوگ: `/admin/products/*`, `/admin/categories`, `/admin/brands`, `/admin/product-prices`, `/admin/fx-pricing`, `/admin/variant-discounts`, `/admin/product-inquiries`.

سفارش و عملیات: `/admin/orders`, `/admin/shipments`, `/admin/returns`, `/admin/pos`, `/admin/inventory/*`, `/admin/warehouse-issues`, `/admin/supply/*`, `/admin/marketplace`, `/admin/pickup-centers`, `/admin/carriers`.

مالی و مشتری: `/admin/accounting`, `/admin/customer-wallet`, `/admin/loyalty`, `/admin/loyalty/reports`, `/admin/affiliates`, `/admin/giftcards`, `/admin/discounts`, `/admin/festivals`, `/admin/campaigns`, `/admin/incomplete-carts`, `/admin/automations`.

محتوا و تنظیم: `/admin/blog/*`, `/admin/media`, `/admin/site-content`, `/admin/home-builder`, `/admin/footer-builder`, `/admin/menus`, `/admin/forms`, `/admin/stories`, `/admin/appearance`, `/admin/labels`, `/admin/payment-gateways`, `/admin/sms`, `/admin/settings`, `/admin/users`, `/admin/access`, `/admin/audit`, `/admin/trash`, `/admin/updates`, `/admin/analytics`.

## خانواده‌های API

`public.ts`: auth, product, media, cart quote, order create/cancel/confirm, supply create/customer action, tickets, notifications, view logs, alerts.

`staff.ts`: products/offers, seller settlements, shipments, orders, withdrawals, supply, inventory, journals, tickets, SMS, settings, users.

`commerce.ts`, `customer.ts`, `seller-pos.ts`, `central-pos.ts`, `marketing.ts`, `gateway.ts`, `payments.ts`, `inventory-documents.ts`, `warehouse.ts`, `content.ts`, `site-menus.ts`, `media-library.ts`, `forms.ts`, `community.ts`, `affiliates.ts`, `analytics.ts`, `pickup.ts`, `brands.ts`, `stories.ts`, `product-inquiries.ts`, `product-import.ts`, `fx-pricing.ts`, `trash.ts`, `kyc.ts`, `extra.ts` به ترتیب دامنه‌های هم‌نام را تکمیل می‌کنند.

## پیدا کردن route دقیق

- صفحه: `rg --files src/app`.
- API: `rg -n 'pattern:' src/lib/api`.
- جدول: نام export در `src/db/schema.ts`; migration مربوط را در `drizzle/` جست‌وجو کنید.
- business rule: ابتدا `src/lib/services/`; سپس caller handler را دنبال کنید.

## قرارداد پوشش مسیر

این سند فهرست گروهی است، نه OpenAPI کامل. routeهای `[id]`, `[slug]` و catch-all را از فایل‌های صفحه/handler استخراج کنید و در تغییر مسیر، deep link، redirect، middleware و auth را نیز بررسی کنید. `src/app/api/[...path]/route.ts` dispatch مرکزی است؛ هر handler تازه باید به `routes` اضافه و الگوی cache invalidation مناسبش بررسی شود.

برای تکمیل واقعی مرجع API، endpointها باید در سند جدا به‌شکل method + path + auth/permission + schema ورودی + schema پاسخ + خطاهای ممکن + اثر جانبی ثبت شوند. در وضعیت فعلی نام فایل‌های API پوشش داده شده، ولی همهٔ قراردادهای endpoint به این سطح مستند نیستند.
