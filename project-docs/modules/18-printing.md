# فاکتور، لیبل و خروجی چاپی

## مسیرهای چاپ

در `src/app/print/`: فاکتور فروش `/invoice/[id]`, سفارش `/order/[id]`, لیبل عمومی `/label/[id]`, لیبل سفارش چندمرسوله `/order-labels/[id]`, POS `/pos/[kind]/[id]`, لیبل فروش حضوری `/pos-label/[id]`, barcode variant `/product-barcodes/[id]`, سند انبار `/inventory-document/[id]`, خروجی موجودی `/warehouse-stock/[id]`, سند حسابداری `/journal/[id]` و issue انبار. `print/layout.tsx` shell چاپ را جدا می‌کند.

## داده و طراحی

- invoice/label design settings در `settings` و manager UI در `/admin/labels`/`PrintDesignManager.tsx`.
- order/pos/inventory/accounting هرکدام منبع داده/اجازهٔ دسترسی مختص خود دارند؛ نباید invoice از payload client تولید شود.
- بارکد برای تنوع‌ها باید SKU یا شناسهٔ یکتا را encode کند و نام محصول/عنوان تنوع readable label باشد.
- export stock/order در routeهای جدا، از جمله `/admin/orders/export` و inventory stock `.xlsx`.

## قواعد چاپ

- فرمت چاپ با CSS print media، صفحه/عرض/فونت تنظیم‌شده و contrast در light/dark browser سنجیده شود.
- برای پس‌کرایه مبلغ freight در invoice صفر و عبارت «پس‌کرایه» روی فاکتور/لیبل بیاید.
- فاکتور برگشت باید به sale/order و روش refund اشاره کند؛ سند روکش مالی شامل شماره سند، تاریخ، شرح، سرفصل، تفصیلی، بدهکار/بستانکار و جمع تراز است.
- modal preview باید focus و Enter/print را درست مدیریت کند؛ iframe print به آماده‌شدن سند نیاز دارد.

## ریسک

- اطلاعات گیرنده و صورتحساب، دادهٔ شخصی است؛ endpoint چاپ باید authentication/ownership یا مجوز staff داشته باشد.
- چند نوع فروش ID مستقل دارند؛ kind باید اجباری/معتبر باشد تا ID یک فروشنده با ID فروش مرکزی اشتباه خوانده نشود.
- طراحی فاکتور/لیبل user-editable است؛ template tokens را allowlist کنید و HTML دلخواه را هنگام print امن render کنید.

## قرارداد قالب و داده

طراحی فاکتور/لیبل از پارامترهای ذخیره‌شده در settings می‌آید؛ نام کسب‌وکار، لوگو، واحد پول و پارامترهای فاکتور باید از تنظیمات جاری resolve شوند، در حالی که مبلغ/اقلام/گیرنده از snapshot سند فروش می‌آیند. برای پس‌کرایه، هزینهٔ پرداختنی صفر و برچسب «پس‌کرایه» روی فاکتور و لیبل است. barcode انتخابی باید برای هر تنوع به SKU/شناسهٔ همان variant مربوط باشد و نام محصول و عنوان تنوع نیز خوانا چاپ شود.

## معیارهای پذیرش

- preview و چاپ نهایی از یک renderer و یک template config استفاده کنند؛ اختلاف داده یا style میانشان نباشد.
- پرینت در light/dark app theme همیشه روی زمینهٔ چاپ سفید و متن خوانا باشد.
- modal/preview به اندازهٔ محتوای بلند scroll داشته باشد؛ فرمان Enter یا دکمهٔ چاپ در focus درست اجرا شود.
- خروجی سند حسابداری، شماره/تاریخ/شرح/حساب و تفصیلی/بدهکار/بستانکار/جمع را درست و متوازن نشان دهد.
- route چاپ با `kind` معتبر و authorization کنترل شود تا شناسهٔ POS مرکزی با فروشنده اشتباه نشود.
