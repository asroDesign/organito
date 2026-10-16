# فهرست method/path برای APIهای داخلی

این فهرست از آرایه‌های `Route` در `src/lib/api/*.ts` استخراج شده و با catch-all در `src/app/api/[...path]/route.ts` از زیر `/api/` در دسترس است. پارامترهای `:id`/`:slug` مسیر هستند. این فهرست method و path را نشان می‌دهد، اما جای مستند قرارداد ورودی/خروجی، permission، خطا و side effect را نمی‌گیرد؛ برای هر mutation حساس فایل handler و service را بخوانید.

آخرین استخراج: ۲۰۲۶-۱۰-۱۱ — 278 جفت method/path یکتا در 29 خانوادهٔ route.

## قواعد dispatch

- متدهای catch-all شامل GET، POST، PUT و DELETE هستند؛ هر route تنها method ثبت‌شده در declaration را می‌پذیرد.
- handlerها در `src/app/api/[...path]/route.ts` به فهرست مرکزی اضافه شده‌اند؛ فایل جدید بدون اتصال به آرایهٔ routes قابل دسترسی نیست.
- مسیر دقیق ثابت بر مسیر پارامتری با specificity بیشتر مقدم است؛ ورودی write به‌طور پیش‌فرض CSRF header و same-origin را می‌خواهد.
- `requireApi(...)` در handler منبع اعمال احراز/permission است؛ این فهرست مجوز هر مسیر را استنتاج نمی‌کند.

## `affiliates.ts`

| Method | Path |
|---|---|
| `GET` | `/api/customer/affiliate` |
| `POST` | `/api/customer/affiliate/apply` |
| `POST` | `/api/customer/affiliate/withdraw` |
| `GET` | `/api/admin/affiliates` |
| `POST` | `/api/admin/affiliate-program` |
| `POST` | `/api/admin/affiliate-products/:id` |
| `POST` | `/api/admin/affiliates/:id` |
| `POST` | `/api/admin/affiliate-withdrawals/:id` |

## `analytics.ts`

| Method | Path |
|---|---|
| `POST` | `/api/analytics/events` |

## `brands.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/brands` |
| `POST` | `/api/admin/brands` |
| `PUT` | `/api/admin/brands/:id` |
| `DELETE` | `/api/admin/brands/:id` |
| `POST` | `/api/admin/brands/:id/trash` |

## `central-pos.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/loyalty` |
| `GET` | `/api/admin/loyalty/tiers` |
| `PUT` | `/api/admin/loyalty/tiers` |
| `POST` | `/api/admin/loyalty/members` |
| `POST` | `/api/admin/loyalty/members/:id/consent` |
| `DELETE` | `/api/admin/loyalty/members/:id` |
| `GET` | `/api/admin/loyalty/birthdays` |
| `GET` | `/api/admin/loyalty/birthday-history` |
| `POST` | `/api/admin/loyalty/birthday-settings` |
| `POST` | `/api/admin/loyalty/birthday-campaign` |
| `GET` | `/api/admin/pos/terminals` |
| `GET` | `/api/admin/settings/pos-terminals` |
| `POST` | `/api/admin/settings/pos-terminals` |
| `PUT` | `/api/admin/settings/pos-terminals/:id` |
| `DELETE` | `/api/admin/settings/pos-terminals/:id` |
| `GET` | `/api/admin/pos/products` |
| `POST` | `/api/admin/pos/shipping-options` |
| `POST` | `/api/admin/pos/:id/shipping` |
| `GET` | `/api/admin/pos/recent` |
| `POST` | `/api/admin/pos` |

## `commerce.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/giftcards/terminals` |
| `GET` | `/api/admin/giftcards` |
| `POST` | `/api/admin/giftcards` |
| `POST` | `/api/admin/giftcards/:id/revoke` |
| `GET` | `/api/customer/credit` |
| `POST` | `/api/returns` |
| `GET` | `/api/admin/returns` |
| `GET` | `/api/seller/returns` |
| `GET` | `/api/customer/returns` |

## `community.ts`

| Method | Path |
|---|---|
| `POST` | `/api/products/:id/reviews` |
| `POST` | `/api/reviews/:id/vote` |
| `POST` | `/api/admin/reviews/:id` |
| `POST` | `/api/products/:id/questions` |
| `POST` | `/api/questions/:id/answers` |
| `POST` | `/api/admin/questions/:id` |
| `POST` | `/api/admin/answers/:id` |
| `GET` | `/api/search` |
| `POST` | `/api/auth/otp/request` |
| `POST` | `/api/auth/otp/verify` |
| `POST` | `/api/admin/hero` |

## `content.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/site-pages` |
| `POST` | `/api/admin/site-pages` |
| `POST` | `/api/admin/site-pages/:id` |
| `GET` | `/api/admin/site-pages/:id/revisions` |
| `POST` | `/api/admin/site-pages/:id/restore/:revisionId` |
| `GET` | `/api/admin/footer-links` |
| `POST` | `/api/admin/footer-links` |
| `POST` | `/api/admin/footer-links/:id` |
| `POST` | `/api/admin/blog` |
| `POST` | `/api/admin/blog/:id` |
| `GET` | `/api/admin/blog/taxonomy` |
| `POST` | `/api/admin/blog/categories` |
| `POST` | `/api/admin/blog/categories/:id` |
| `POST` | `/api/admin/blog/tags` |
| `POST` | `/api/admin/blog/tags/:id` |

## `crm.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/users` |
| `POST` | `/api/admin/users` |
| `POST` | `/api/admin/users/:id` |
| `GET` | `/api/admin/access/roles` |

## `customer.ts`

| Method | Path |
|---|---|
| `GET` | `/api/customer/sessions` |
| `DELETE` | `/api/customer/sessions/:id` |
| `GET` | `/api/customer/addresses` |
| `POST` | `/api/customer/addresses` |
| `PUT` | `/api/customer/addresses/:id` |
| `DELETE` | `/api/customer/addresses/:id` |
| `GET` | `/api/customer/favorites` |
| `POST` | `/api/customer/favorites` |
| `GET` | `/api/customer/wallet` |
| `PUT` | `/api/customer/wallet/bank` |
| `POST` | `/api/customer/wallet/withdraw` |
| `POST` | `/api/customer/wallet/convert-points` |
| `GET` | `/api/customer/referrals` |
| `GET` | `/api/admin/customer-wallet-withdrawals` |
| `PUT` | `/api/admin/customer-wallet-withdrawals/:id` |

## `extra.ts`

| Method | Path |
|---|---|
| `POST` | `/api/admin/product-prices` |
| `POST` | `/api/cart/recovery` |
| `POST` | `/api/admin/incomplete-carts/:id` |
| `POST` | `/api/admin/categories` |
| `POST` | `/api/admin/categories/:id` |
| `POST` | `/api/admin/ticket-departments` |
| `POST` | `/api/admin/ticket-departments/:id` |
| `POST` | `/api/admin/tickets/:id/refer` |
| `POST` | `/api/admin/sms-templates` |
| `POST` | `/api/admin/sms-templates/:id` |
| `POST` | `/api/admin/sms/send` |
| `POST` | `/api/admin/sms/logs/:id/retry` |
| `POST` | `/api/admin/accounts` |
| `POST` | `/api/admin/accounts/:id` |
| `POST` | `/api/admin/detail-accounts` |
| `POST` | `/api/admin/detail-accounts/:id` |
| `POST` | `/api/admin/journal2` |
| `POST` | `/api/me/avatar` |
| `POST` | `/api/me/profile` |
| `POST` | `/api/me/password` |

## `forms.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/forms` |
| `POST` | `/api/admin/forms` |
| `PUT` | `/api/admin/forms/:id` |
| `GET` | `/api/admin/forms/:id/submissions` |
| `GET` | `/api/admin/forms/:id/export` |
| `GET` | `/api/forms/:slug` |
| `POST` | `/api/forms/:slug/submissions` |

## `fx-pricing.ts`

| Method | Path |
|---|---|
| `POST` | `/api/admin/fx-rates` |
| `POST` | `/api/admin/fx-product-prices` |
| `POST` | `/api/admin/fx-pricing/preview` |
| `POST` | `/api/admin/fx-pricing/apply` |

## `gateway.ts`

| Method | Path |
|---|---|
| `POST` | `/api/payments/torobpay/eligible` |
| `POST` | `/api/payments/snappay/eligible` |
| `POST` | `/api/orders/:id/gateway` |
| `POST` | `/api/supply/:id/gateway` |
| `POST` | `/api/customer/wallet/gateway` |
| `GET` | `/api/payments/zarinpal/callback` |
| `GET` | `/api/payments/zibal/callback` |
| `POST` | `/api/payments/torobpay/callback` |
| `POST` | `/api/payments/nextpay/callback` |
| `POST` | `/api/payments/digipay/callback` |
| `POST` | `/api/payments/snappay/callback` |
| `POST` | `/api/payments/behpardakht/callback` |
| `GET` | `/api/payments/vandar/callback` |
| `POST` | `/api/payments/pasargad/callback` |
| `GET` | `/api/payments/gateway-mode` |

## `home-builder.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/home-builder` |
| `GET` | `/api/admin/home-builder/products` |
| `POST` | `/api/admin/home-builder` |

## `inventory-documents.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/inventory/warehouses/:id/stock.xlsx` |
| `GET` | `/api/admin/inventory/documents` |
| `GET` | `/api/admin/inventory/documents/:id` |
| `POST` | `/api/admin/inventory/documents` |
| `POST` | `/api/admin/inventory/documents/:id/accept` |

## `kyc.ts`

| Method | Path |
|---|---|
| `POST` | `/api/seller/profile` |
| `POST` | `/api/seller/documents` |
| `POST` | `/api/admin/sellers/:id/documents/request` |
| `POST` | `/api/admin/seller-documents/:id/review` |
| `POST` | `/api/admin/sellers/:id/restrict` |
| `POST` | `/api/admin/sellers/:id/terms` |
| `GET` | `/api/notifications` |
| `POST` | `/api/notifications/:id/read` |

## `marketing.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/discounts/customers` |
| `GET` | `/api/admin/discounts/products` |
| `POST` | `/api/admin/carriers` |
| `POST` | `/api/admin/carriers/:id` |
| `POST` | `/api/admin/carriers/:id/rates` |
| `POST` | `/api/admin/carrier-rates/:id/delete` |
| `POST` | `/api/admin/shipments/:id/info` |
| `POST` | `/api/seller/shipments/:id/info` |
| `POST` | `/api/admin/discounts` |
| `POST` | `/api/admin/discounts/:id` |
| `POST` | `/api/admin/festivals` |
| `POST` | `/api/admin/festivals/:id` |
| `GET` | `/api/admin/variant-discounts/variants` |
| `GET` | `/api/admin/variant-discounts` |
| `POST` | `/api/admin/variant-discounts` |
| `POST` | `/api/admin/variant-discounts/:id` |

## `media-library.ts`

| Method | Path |
|---|---|
| `POST` | `/api/admin/media/folders` |
| `POST` | `/api/admin/media/folders/:id` |
| `POST` | `/api/admin/media/:id/process` |
| `POST` | `/api/admin/media/:id` |

## `payments.ts`

| Method | Path |
|---|---|
| `POST` | `/api/orders/:id/manual-payment` |
| `POST` | `/api/admin/orders/:id/payment` |
| `GET` | `/api/products/:id/quick` |

## `pickup.ts`

| Method | Path |
|---|---|
| `GET` | `/api/pickup-centers` |
| `GET` | `/api/admin/pickup-centers` |
| `POST` | `/api/admin/pickup-centers` |
| `POST` | `/api/admin/pickup-centers/:id` |
| `GET` | `/api/admin/pickup-orders` |
| `POST` | `/api/admin/pickup-orders/:id` |

## `product-import.ts`

| Method | Path |
|---|---|
| `POST` | `/api/admin/products/import-digikala` |

## `product-inquiries.ts`

| Method | Path |
|---|---|
| `POST` | `/api/product-inquiries` |
| `POST` | `/api/admin/product-inquiries/:id` |

## `public.ts`

| Method | Path |
|---|---|
| `POST` | `/api/products/:id/views` |
| `GET` | `/api/products/:id/viewers` |
| `GET` | `/api/admin/products/:id/views` |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/register` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/auth/me` |
| `GET` | `/api/products/:id` |
| `GET` | `/api/products/:id/price-history` |
| `POST` | `/api/product-alerts/request-code` |
| `POST` | `/api/product-alerts/verify` |
| `GET` | `/api/product-alerts/mine` |
| `POST` | `/api/product-alerts/:id/cancel` |
| `POST` | `/api/product-alerts/unsubscribe` |
| `POST` | `/api/cart/quote` |
| `GET` | `/api/media/folders` |
| `GET` | `/api/media/library` |
| `GET` | `/api/media/:id` |
| `POST` | `/api/media` |
| `POST` | `/api/orders` |
| `POST` | `/api/orders/:id/confirm` |
| `POST` | `/api/orders/:id/cancel` |
| `POST` | `/api/supply` |
| `POST` | `/api/supply/:id/customer` |
| `POST` | `/api/tickets` |
| `POST` | `/api/tickets/:id/messages` |
| `POST` | `/api/notifications/read` |
| `GET` | `/api/admin/integrity` |

## `seller-pos.ts`

| Method | Path |
|---|---|
| `GET` | `/api/seller/pos/terminals` |
| `GET` | `/api/seller/loyalty/terminals` |
| `POST` | `/api/seller/loyalty/terminals` |
| `PUT` | `/api/seller/loyalty/terminals/:id` |
| `DELETE` | `/api/seller/loyalty/terminals/:id` |
| `GET` | `/api/seller/pos/products` |
| `GET` | `/api/seller/pos/recent` |
| `POST` | `/api/seller/pos` |
| `GET` | `/api/seller/loyalty/rewards/:code` |
| `PUT` | `/api/seller/loyalty/reward-settings` |
| `GET` | `/api/seller/loyalty` |
| `POST` | `/api/seller/loyalty/members` |
| `POST` | `/api/seller/loyalty/members/:id/consent` |
| `DELETE` | `/api/seller/loyalty/members/:id` |
| `PUT` | `/api/seller/loyalty/sms-settings` |
| `POST` | `/api/seller/loyalty/send` |

## `site-menus.ts`

| Method | Path |
|---|---|
| `POST` | `/api/admin/footer-builder` |
| `GET` | `/api/admin/site-menus` |
| `POST` | `/api/admin/site-menus` |
| `POST` | `/api/admin/site-menus/reorder` |
| `POST` | `/api/admin/site-menu-items/:id` |

## `staff.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/inventory/warehouses` |
| `POST` | `/api/admin/inventory/warehouses` |
| `PUT` | `/api/admin/inventory/warehouses/:id` |
| `POST` | `/api/admin/inventory/warehouses/transfers` |
| `POST` | `/api/products` |
| `PUT` | `/api/products/:id` |
| `POST` | `/api/products/:id/status` |
| `POST` | `/api/seller/offers` |
| `POST` | `/api/seller/offers/:id/status` |
| `POST` | `/api/seller/shipments/:id` |
| `POST` | `/api/seller/withdrawals` |
| `POST` | `/api/seller/withdrawals/:id/cancel` |
| `POST` | `/api/seller/rfq/:id` |
| `GET` | `/api/seller/report.csv` |
| `POST` | `/api/admin/offers/:id/status` |
| `POST` | `/api/admin/offers/:id/buybox` |
| `POST` | `/api/admin/sellers/:id` |
| `POST` | `/api/admin/shipments/:id` |
| `POST` | `/api/admin/orders/:id/cancel` |
| `POST` | `/api/admin/orders/:id/pay` |
| `POST` | `/api/admin/withdrawals/:id` |
| `POST` | `/api/admin/supply/:id` |
| `POST` | `/api/admin/inventory/repack` |
| `POST` | `/api/admin/inventory/parties` |
| `POST` | `/api/admin/inventory/parties/:id/payments` |
| `POST` | `/api/admin/inventory/:id` |
| `POST` | `/api/admin/journal` |
| `POST` | `/api/admin/journal/:id/reverse` |
| `GET` | `/api/admin/tickets/customers` |
| `POST` | `/api/admin/tickets` |
| `POST` | `/api/admin/tickets/:id` |
| `POST` | `/api/admin/sms/test` |
| `POST` | `/api/admin/sms/:id` |
| `POST` | `/api/admin/settings` |
| `POST` | `/api/admin/users` |
| `POST` | `/api/admin/users/:id` |

## `stories.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/stories` |
| `POST` | `/api/admin/stories` |
| `PUT` | `/api/admin/stories/:id` |
| `DELETE` | `/api/admin/stories/:id` |
| `GET` | `/api/stories` |
| `POST` | `/api/stories/:id/interaction` |

## `trash.ts`

| Method | Path |
|---|---|
| `GET` | `/api/admin/trash` |
| `POST` | `/api/admin/trash/:kind/:id/restore` |

## `warehouse.ts`

| Method | Path |
|---|---|
| `POST` | `/api/shipments/:id/issue` |
| `POST` | `/api/warehouse-issues/:id/handover` |
| `POST` | `/api/warehouse-issues/:id/cancel` |
