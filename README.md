# یدک‌تک (YadakTech) — مارکت‌پلیس و سامانه تأمین قطعات خودرو

Next.js 16 (App Router) · React 19 · TypeScript strict · PostgreSQL · Drizzle ORM · Tailwind 4 · Vazirmatn · Lucide · RTL

## نصب و اجرا
```bash
cp .env.example .env          # DATABASE_URL را تنظیم کنید
npm install
npx drizzle-kit push          # یا اجرای drizzle/0000_init.sql
npm run build && npm start    # یا npm run dev
```
اولین درخواست به سرور، دیتابیس خالی را **به‌صورت خودکار Seed** می‌کند (با advisory lock). سفارش‌ها و اسناد نمونه از طریق همان سرویس‌های واقعی ساخته می‌شوند، پس حسابداری از ابتدا متوازن است.

**Migration:** `drizzle/0000_init.sql` (تولیدشده با `drizzle-kit generate`). برای تغییرات بعدی: ویرایش `src/db/schema.ts` و سپس `npx drizzle-kit push` یا `generate`.

## حساب‌های آزمایشی (رمز همه: `Demo@1234`)
| نقش | موبایل |
|---|---|
| مدیر کل | 09120000001 |
| مدیر مارکت‌پلیس | 09120000002 |
| مدیر خرید و تأمین | 09120000003 |
| مدیر انبار | 09120000004 |
| حسابدار | 09120000005 |
| پشتیبان | 09120000006 |
| مدیر کاتالوگ | 09120000007 |
| مشتری | 09121111111 ، 09122222222 |
| تأمین‌کننده (تأییدشده) | 09123333331 ، 09123333332 ، 09123333333 |
| تأمین‌کننده (در انتظار پذیرش) | 09123333334 |

## معماری
- `src/db/schema.ts` — ۳۰ جدول (کاربران، نشست، فروشنده، کیف پول، محصول، تنوع، پیشنهاد، رسانه bytea، سفارش، مرسوله، پرداخت، برداشت، استعلام، RFQ، حساب/سند/آرتیکل، تیکت، پیامک، تنظیمات، ممیزی، اعلان، idempotency).
- `src/lib/services/*` — قوانین تجاری Transactional (`orders`, `catalog`, `wallet`, `supply`).
- `src/lib/accounting.ts` — دفتر دوبل؛ `postJournal` هر سند نامتوازن را رد می‌کند؛ `reverseJournal` برای برگشت سند.
- `src/lib/rbac.ts` — ۹ نقش و ۲۱ مجوز + مجوزهای اضافه به ازای کاربر.
- `src/app/api/[...path]` — Route Handler مرکزی با CSRF check و router؛ handlerها در `src/lib/api/*`.

## جریان سفارش چندتأمین‌کننده
1. سبد در localStorage (فقط شناسه/تعداد). `POST /api/cart/quote` قیمت/موجودی را از DB محاسبه و بر اساس فروشنده گروه‌بندی می‌کند (ارسال هر گروه = بیشترین تعرفه گروه؛ انبار مرکزی گروه مستقل؛ `finalTotal = items + sellerShipping + centralShipping + tax - discount`).
2. کمبود موجودی → پیشنهادهای جایگزین (Buy Box، قیمت، زمان) به کاربر نمایش داده می‌شود؛ تغییر فروشنده فقط با انتخاب کاربر.
3. `POST /api/orders` در یک Transaction: `SELECT … FOR UPDATE` روی محصول/پیشنهاد/تنوع با ترتیب قطعی، اعتبارسنجی، `UPDATE … WHERE stock - reserved >= qty`، ساخت Order/OrderItem/SellerShipment، Stock Movement، اعلان فروشندگان، Audit. کلید Idempotency یکتا.
4. پرداخت (`/pay`، idempotent) → سند: بانک بدهکار؛ فروش مرکزی، درآمد حمل، مالیات و «کیف پول فروشندگان-در انتظار» بستانکار؛ `pendingBalance` افزایش.
5. فروشنده فقط مرسوله خود را: pending → preparing → ready (بسته‌بندی) → shipped (حامل + کد رهگیری). در ارسال: کسر stock و آزادسازی reserved؛ برای انبار مرکزی سند بهای تمام‌شده (میانگین موزون).
6. مشتری «تأیید دریافت» → تمام مرسوله‌ها delivered، سفارش completed.
7. لغو (قبل از ارسال) → آزادسازی رزرو، برگشت سند پرداخت و کاهش pending.

## جریان کیف پول و تسویه
- تحویل مرسوله → `commission = itemsTotal × rate/100`، `net = gross - commission - deductions`؛ pending↓، available↑؛ سند: 2101 بدهکار / 2102 و 4102 بستانکار.
- برداشت: قفل ردیف کیف پول، بررسی حداقل و موجودی، انتقال available→locked، وضعیت pending → approved → processing → paid (با شماره پیگیری و سند 2102/1101) یا rejected/cancelled (آزادسازی).

## جریان تأمین Part Number
ثبت (PN/OEM، خودرو، VIN، تصویر) → reviewing → جست‌وجوی کاتالوگ و Cross Reference (نرمال‌سازی PN) → internal_match_found یا supplier_search → RFQ به تأمین‌کنندگان → پاسخ قیمت/موجودی/Lead Time → مقایسه و انتخاب → محاسبه قیمت با حاشیه → quotation_sent → تأیید مشتری → payment_pending → paid (پیش‌دریافت 2103) → purchasing → received → ready_to_ship → shipped → completed (تحقق درآمد و بهای تمام‌شده و اعتبار کیف پول تأمین‌کننده). تمام انتقال‌ها با ماشین حالت `SUPPLY_FLOW` کنترل و در history + Audit ثبت می‌شوند.

## فهرست API
| روش | مسیر | دسترسی |
|---|---|---|
| POST | /api/auth/login · register · logout | عمومی (Rate limit) |
| GET | /api/auth/me · /api/products/:id · /api/media/:id | عمومی |
| POST | /api/cart/quote | عمومی |
| POST | /api/media | کاربر واردشده (MIME + magic bytes، ۳MB) |
| POST | /api/orders · /orders/:id/pay · /confirm · /cancel | مشتری مالک |
| POST | /api/supply · /api/supply/:id/customer | مشتری |
| POST | /api/tickets · /tickets/:id/messages · /notifications/read | کاربر |
| POST/PUT | /api/products · /products/:id · /products/:id/status | فروشنده مالک / PRODUCTS_* |
| POST | /api/seller/offers · offers/:id/status · shipments/:id · withdrawals · withdrawals/:id/cancel · rfq/:id | فروشنده |
| GET | /api/seller/report.csv | فروشنده |
| POST | /api/admin/offers/:id/status · buybox | SUPPLIER_OFFERS_MANAGE |
| POST | /api/admin/sellers/:id | SELLER_SETTLEMENT_MANAGE |
| POST | /api/admin/shipments/:id | SHIPMENTS_MANAGE |
| POST | /api/admin/orders/:id/cancel · pay | ORDERS_MANAGE · PAYMENTS_MANAGE |
| POST | /api/admin/withdrawals/:id | WITHDRAWALS_MANAGE |
| POST | /api/admin/supply/:id | SUPPLY_REQUESTS_MANAGE |
| POST | /api/admin/inventory/:id | INVENTORY_MANAGE |
| POST | /api/admin/journal · journal/:id/reverse | ACCOUNTING_MANAGE |
| POST | /api/admin/tickets/:id | TICKETS_MANAGE |
| POST | /api/admin/sms/:id · sms/test | SMS_MANAGE |
| POST | /api/admin/settings | SETTINGS_MANAGE |
| POST | /api/admin/users · users/:id | USERS_MANAGE |
| GET | /api/admin/integrity | AUDIT_LOG_VIEW |

## امنیت
Session httpOnly (توکن هش‌شده SHA-256)، scrypt برای رمز، CSRF (هدر سفارشی `x-csrf` + بررسی Origin)، Rate limit (ورود، ثبت‌نام، استعلام، آپلود، پیامک آزمایشی)، جلوگیری از IDOR در تمام سرویس‌ها، Mask شبا/تلفن، حذف secretها از Audit، کلید API پیامک فقط از env، فایل‌ها در DB (بدون Path Traversal)، Soft delete برای محصول و تغییر وضعیت برای مالی/سفارش.

## گزارش تست و اعتبارسنجی
- `next typegen` ✓ · `tsc --noEmit` ✓ · `next build` ✓
- تست E2E با curl روی سرور تولیدی:
  - سفارش ۳ مرسوله‌ای (۲ فروشنده + انبار مرکزی) ✓، تکرار با همان Idempotency Key همان سفارش را برگرداند ✓
  - رزرو ۰→۲ ✓؛ پس از ارسال stock 24→22 و reserved→0 ✓
  - فروش بیش از موجودی رد شد ✓؛ پرداخت سفارش دیگران (IDOR) رد شد ✓؛ درخواست بدون CSRF رد شد ✓
  - فروشنده ۲ روی مرسوله فروشنده ۱ → 404 ✓؛ تأیید دریافت پیش از ارسال رد شد ✓
  - آزادسازی: pending −2,840,000 و available +2,617,600 (کمیسیون ۸٪ = 222,400) ✓
  - برداشت بیش از موجودی رد شد ✓؛ approve→pay با سند ✓
  - `/api/admin/integrity`: جمع بدهکار = جمع بستانکار، ۰ سند نامتوازن، ۰ رزرو/کیف پول نامعتبر ✓


### فروش حضوری تأمین‌کنندگان

فروشنده از «فروش حضوری» صندوق اختصاصی خود را ثبت می‌کند؛ موجودی آزاد همان پیشنهاد فروش کم می‌شود و این فروش در گزارش مالی با کمیسیون صفر منظور می‌شود. «باشگاه مشتریان» فهرست مستقل هر فروشنده را نگه می‌دارد. پیش از فعال‌سازی، schema را روی PostgreSQL اجرا کنید (`npx drizzle-kit push`) یا migrationهای `drizzle/0001_seller_pos_loyalty.sql`، `drizzle/0002_pos_terminals_loyalty_rewards.sql` و `drizzle/0003_central_loyalty_birthday.sql` را به‌ترتیب اعمال کنید. هر فروشنده می‌تواند کارتخوان‌های مستقل خود را در تنظیمات باشگاه تعریف کند؛ پرداخت کارتی یا ترکیبی فقط با انتخاب یکی از کارتخوان‌های فعال ممکن است. اعضای باشگاه با نام، تلفن، تاریخ تولد، رضایت پیامک، تعداد مراجعه و مجموع خرید نگهداری می‌شوند. پس از خرید حضوری، در صورت رضایت مشتری کد پاداش یک‌بارمصرف صادر می‌شود؛ درصد، حداقل خرید و مهلت آن را تأمین‌کننده تنظیم می‌کند و کد در خرید حضوری بعدی همان فروشگاه قابل استفاده است. هر فروشنده کلید API و خط فرستندهٔ پنل پیامک خودش را تنظیم می‌کند؛ پیام‌های خرید و پیامک گروهی فقط با رضایت مشتری ارسال می‌شوند. مدیر نیز کارتخوان‌های انبار مرکزی را در تنظیمات مدیریت تعریف می‌کند.


باشگاه مشتریان مرکزی ادمین در «باشگاه مشتریان» فهرست اعضا، تاریخ تولد و وضعیت رضایت پیامکی را مدیریت می‌کند. صندوق مرکزی می‌تواند مشتری را با رضایت و تاریخ تولد ثبت کند؛ ارسال پیامک تولد به گیرندگان واجدشرایط در همین پنل انجام می‌شود.
