"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, PackageSearch, Search, UserRound, X } from "lucide-react";
import { api, toast } from "./client";
import { JalaliDatePicker } from "./JalaliDatePicker";

type Customer = { id: number; name: string; phone: string };
type Product = { id: number; name: string; sku: string; brand: string; categoryId: number | null };
type Category = { id: number; name: string };
const toman = (value: number) => `${Math.max(0, value).toLocaleString("fa-IR")} تومان`;

export function DiscountCodeForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [customerPicker, setCustomerPicker] = useState(false), [customerQuery, setCustomerQuery] = useState(""), [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null), [manualPhone, setManualPhone] = useState("");
  const [productPicker, setProductPicker] = useState(false), [productQuery, setProductQuery] = useState(""), [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]), [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState(""), [endsAt, setEndsAt] = useState(""), [busy, setBusy] = useState(false);

  async function searchCustomers() {
    if (customerQuery.trim().length < 2) return toast("برای جستجوی مشتری حداقل دو حرف یا رقم وارد کنید", false);
    setBusy(true);
    try { setCustomers(await api<Customer[]>(`/api/admin/discounts/customers?q=${encodeURIComponent(customerQuery.trim())}`, "GET")); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  }
  async function searchProducts() {
    if (productQuery.trim().length < 2) return toast("برای جستجوی محصول حداقل دو حرف یا رقم وارد کنید", false);
    setBusy(true);
    try { setProducts(await api<Product[]>(`/api/admin/discounts/products?q=${encodeURIComponent(productQuery.trim())}`, "GET")); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  }
  const enterSearch = (search: () => Promise<void>) => (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); void search(); } };
  const toggleProduct = (product: Product) => setSelectedProducts((current) => current.some((item) => item.id === product.id) ? current.filter((item) => item.id !== product.id) : [...current, product]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    setBusy(true);
    try {
      await api("/api/admin/discounts", "POST", {
        code: fields.get("code"), title: fields.get("title"), type: fields.get("type"), value: Number(fields.get("value")),
        maxDiscount: Number(fields.get("maxDiscount") || 0), minOrder: Number(fields.get("minOrder") || 0),
        startsAt, endsAt, usageLimit: Number(fields.get("usageLimit") || 0), perUserLimit: Number(fields.get("perUserLimit") || 0),
        customerId: customer?.id ?? null, customerPhone: customer ? "" : manualPhone,
        productIds: selectedProducts.map((product) => product.id), categoryIds: selectedCategories,
      });
      toast("کد تخفیف ایجاد شد");
      form.reset(); setCustomer(null); setManualPhone(""); setSelectedProducts([]); setSelectedCategories([]); setStartsAt(""); setEndsAt("");
      router.refresh();
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };

  return <>
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">کد (انگلیسی) *</span><input name="code" required maxLength={30} className="input" placeholder="YALDA1405" dir="ltr" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">عنوان</span><input name="title" maxLength={120} className="input" placeholder="تخفیف خرید بعدی" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">نوع تخفیف</span><select name="type" className="input"><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت (تومان)</option></select></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">مقدار *</span><input name="value" required type="number" min="1" className="input" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">سقف تخفیف (تومان)</span><input name="maxDiscount" type="number" min="0" defaultValue="0" className="input" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">حداقل مبلغ خرید (تومان)</span><input name="minOrder" type="number" min="0" defaultValue="0" className="input" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">شروع اعتبار</span><JalaliDatePicker value={startsAt} onChange={setStartsAt} allowEmpty placeholder="بدون تاریخ شروع" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">پایان اعتبار</span><JalaliDatePicker value={endsAt} onChange={setEndsAt} allowEmpty placeholder="بدون تاریخ پایان" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">سقف کل استفاده</span><input name="usageLimit" type="number" min="0" defaultValue="0" placeholder="۰ = نامحدود" className="input" /></label>
      <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1"><span className="text-slate-600">سقف هر مشتری</span><input name="perUserLimit" type="number" min="0" defaultValue="1" placeholder="۰ = نامحدود" className="input" /></label>

      <section className="col-span-2 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="flex items-center gap-2 text-sm"><UserRound className="size-4 text-emerald-700"/>محدود به مشتری خاص</b><p className="mt-1 text-xs text-slate-500">مشتری فعال را از فهرست انتخاب کنید یا موبایل را دستی وارد کنید.</p></div>
          <button type="button" className="btn-sm" onClick={() => setCustomerPicker(true)}><Search className="size-3.5"/>انتخاب از کاربران</button></div>
        {customer ? <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 p-2.5 text-sm"><span className="min-w-0"><b>{customer.name}</b><small className="mr-2 text-slate-500" dir="ltr">{customer.phone}</small></span><button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="حذف مشتری انتخاب‌شده" onClick={() => setCustomer(null)}><X className="size-4"/></button></div> : <label className="mt-3 block text-xs font-bold">ورود دستی شماره موبایل<input inputMode="tel" autoComplete="tel" dir="ltr" className="input mt-1 text-left" placeholder="0912…" value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} /></label>}
      </section>

      <section className="col-span-2 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="flex items-center gap-2 text-sm"><PackageSearch className="size-4 text-emerald-700"/>محدود به محصولات</b><p className="mt-1 text-xs text-slate-500">چند محصول را با جستجوی نام، SKU یا کد محصول انتخاب کنید.</p></div><button type="button" className="btn-sm" onClick={() => setProductPicker(true)}><Search className="size-3.5"/>جستجو و انتخاب محصول</button></div>
        {selectedProducts.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selectedProducts.map((product) => <span key={product.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900"><span className="truncate">{product.name}</span><button type="button" aria-label={`حذف ${product.name}`} onClick={() => toggleProduct(product)} className="rounded-full p-0.5 hover:bg-emerald-100"><X className="size-3.5"/></button></span>)}</div>}
      </section>

      <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="text-slate-600">محدود به دسته‌بندی‌ها (اختیاری)</span><select multiple value={selectedCategories.map(String)} onChange={(event) => setSelectedCategories(Array.from(event.target.selectedOptions, (option) => Number(option.value)))} className="input min-h-28"><option value="" disabled>برای انتخاب چند دسته، از Ctrl یا Command استفاده کنید</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <button disabled={busy} className="btn-primary col-span-2 w-full">{busy ? "در حال ثبت…" : "ایجاد کد تخفیف"}</button>
    </form>

    {customerPicker && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3" role="dialog" aria-modal="true" aria-label="انتخاب مشتری"><section className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-4"><div><b>انتخاب مشتری فعال</b><p className="mt-1 text-xs text-slate-500">فقط حساب‌های فعال با نقش مشتری نمایش داده می‌شوند.</p></div><button type="button" onClick={() => setCustomerPicker(false)} aria-label="بستن" className="btn-ghost"><X className="size-4"/></button></header><div className="flex gap-2 p-4"><input autoFocus className="input min-w-0" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} onKeyDown={enterSearch(searchCustomers)} placeholder="نام یا شماره موبایل"/><button type="button" className="btn-primary shrink-0" onClick={() => void searchCustomers()} disabled={busy}>{busy ? "جستجو…" : "جستجو"}</button></div><div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{customers.map((item) => <button type="button" key={item.id} onClick={() => { setCustomer(item); setManualPhone(""); setCustomerPicker(false); }} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 p-3 text-right transition hover:bg-slate-50"><span><b className="block text-sm">{item.name}</b><small dir="ltr" className="mt-1 block text-left text-xs text-slate-500">{item.phone}</small></span><UserRound className="size-4 text-slate-400"/></button>)}{!customers.length && <p className="p-8 text-center text-sm text-slate-500">برای شروع، نام یا موبایل را جستجو کنید.</p>}</div></section></div>}

    {productPicker && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3" role="dialog" aria-modal="true" aria-label="جستجو و انتخاب محصولات"><section className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 p-4"><div><b>جستجو و انتخاب محصولات</b><p className="mt-1 text-xs text-slate-500">{selectedProducts.length.toLocaleString("fa-IR")} محصول انتخاب شده</p></div><button type="button" onClick={() => setProductPicker(false)} aria-label="بستن" className="btn-ghost"><X className="size-4"/></button></header><div className="flex gap-2 p-4"><input autoFocus className="input min-w-0" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} onKeyDown={enterSearch(searchProducts)} placeholder="نام محصول، SKU یا کد محصول"/><button type="button" className="btn-primary shrink-0" onClick={() => void searchProducts()} disabled={busy}>{busy ? "جستجو…" : "جستجو"}</button></div><div className="min-h-0 flex-1 overflow-y-auto px-4">{products.map((product) => { const checked = selectedProducts.some((item) => item.id === product.id); return <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 text-sm transition hover:bg-slate-50"><input type="checkbox" checked={checked} onChange={() => toggleProduct(product)} className="size-4 accent-amber-500"/><span className="min-w-0 flex-1"><b className="block truncate">{product.name}</b><small className="mt-1 block text-xs text-slate-500">{product.brand} · {product.sku}</small></span>{checked && <Check className="size-4 text-emerald-700"/>}</label>; })}{!products.length && <p className="p-8 text-center text-sm text-slate-500">برای شروع، نام یا کد محصول را جستجو کنید.</p>}</div><footer className="flex justify-end border-t border-slate-200 p-4"><button type="button" onClick={() => setProductPicker(false)} className="btn-primary"><Check className="size-4"/>تأیید انتخاب‌ها</button></footer></section></div>}
  </>;
}
