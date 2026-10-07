"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toast } from "./client";

type Values = Record<string, string | number>;
const tabs: { id: string; title: string; enabled: string; icon?: string; fields: [string, string][] }[] = [
  { id: "zarinpal", title: "زرین‌پال", enabled: "paymentZarinpalEnabled", icon: "paymentZarinpalIconId", fields: [["zarinpalMerchantId", "شناسه پذیرنده"], ["zarinpalSandbox", "محیط آزمایشی"]] },
  { id: "zibal", title: "زیبال", enabled: "paymentZibalEnabled", icon: "paymentZibalIconId", fields: [["zibalMerchant", "شناسه مرچنت"]] },
  { id: "torobpay", title: "ترب‌پی", enabled: "paymentTorobpayEnabled", icon: "paymentTorobpayIconId", fields: [["torobpayClientId", "Client ID"], ["torobpayClientSecret", "Client Secret"], ["torobpayUsername", "نام کاربری API"], ["torobpayPassword", "رمز عبور API"]] },
  { id: "nextpay", title: "نکست‌پی", enabled: "paymentNextpayEnabled", icon: "paymentNextpayIconId", fields: [["nextpayApiKey", "کلید API پذیرنده"]] },
  { id: "digipay", title: "دیجی‌پی", enabled: "paymentDigipayEnabled", icon: "paymentDigipayIconId", fields: [["digipayClientId", "Client ID"], ["digipayClientSecret", "Client Secret"], ["digipayUsername", "نام کاربری API"], ["digipayPassword", "رمز عبور API"], ["digipaySandbox", "محیط آزمایشی"], ["digipayAmountMultiplier", "ضریب مبلغ ارسالی"], ["digipayPreferredGateway", "روش پرداخت پیش‌فرض"]] },
  { id: "snappay", title: "اسنپ‌پی", enabled: "paymentSnappayEnabled", icon: "paymentSnappayIconId", fields: [["snappayApiBaseUrl", "نشانی دامنه API پذیرنده"], ["snappayClientId", "Client ID"], ["snappayClientSecret", "Client Secret"], ["snappayUsername", "نام کاربری API"], ["snappayPassword", "رمز عبور API"]] },
  { id: "behpardakht", title: "به‌پرداخت ملت", enabled: "paymentBehpardakhtEnabled", icon: "paymentBehpardakhtIconId", fields: [["behpardakhtTerminalId", "شناسه پایانه"], ["behpardakhtUsername", "نام کاربری پذیرنده"], ["behpardakhtPassword", "رمز عبور پذیرنده"]] },
  { id: "pasargad", title: "پاسارگاد", enabled: "paymentPasargadEnabled", icon: "paymentPasargadIconId", fields: [["pasargadTerminalId", "شماره پایانه"], ["pasargadUsername", "نام کاربری پذیرنده"], ["pasargadPassword", "رمز عبور پذیرنده"]] },
  { id: "vandar", title: "وندار", enabled: "paymentVandarEnabled", icon: "paymentVandarIconId", fields: [["vandarApiKey", "کلید API درگاه"]] },
  { id: "manual", title: "کارت‌به‌کارت / حواله", enabled: "paymentManualEnabled", fields: [] },
];

export function PaymentGatewaySettings({ initial }: { initial: Values }) {
  const [values, setValues] = useState<Values>(initial);
  const [tab, setTab] = useState("behpardakht");
  const [busy, setBusy] = useState(false);
  const current = tabs.find((x) => x.id === tab)!;
  const value = (key: string) => values[key] ?? "";
  const set = (key: string, next: string | number) => setValues((old) => ({ ...old, [key]: next }));
  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/settings", "POST", { ...values, paymentGatewaysConfigured: 1 });
      set("paymentGatewaysConfigured", 1);
      toast("تنظیمات درگاه‌های پرداخت ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">درگاه‌های پرداخت</h2><p className="mt-1 text-sm text-slate-500">چند درگاه را همزمان فعال کنید؛ مشتری هنگام تسویه درگاه موردنظرش را انتخاب می‌کند.</p></div><button className="btn-primary" type="button" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />}ذخیره تنظیمات</button></div>
    <div role="tablist" className="mb-5 flex gap-2 overflow-x-auto border-b pb-2">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-t-xl px-4 py-2 text-sm font-bold ${tab === item.id ? "bg-amber-100 text-amber-950" : "text-slate-500 hover:bg-slate-50"}`}>{item.title}{Number(value(item.enabled)) === 1 && <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />}</button>)}</div>
    {tabs.map((item) => item.id === tab && <div key={item.id} role="tabpanel" className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={Number(value(item.enabled)) === 1} onChange={(e) => set(item.enabled, e.target.checked ? 1 : 0)} />فعال‌بودن درگاه {item.title} در سبد خرید</label>
        {item.fields.map(([key, label]) => key === "zarinpalSandbox" || key === "digipaySandbox" ? <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Number(value(key)) === 1} onChange={(e) => set(key, e.target.checked ? 1 : 0)} />{label}</label> : key === "digipayAmountMultiplier" ? <label key={key} className="block text-sm">واحد مبلغی که پذیرنده دیجی‌پی انتظار دارد<select className="input mt-1" value={String(value(key))} onChange={(e) => set(key, Number(e.target.value))}><option value="10">ریال (تبدیل تومان به ریال × ۱۰)</option><option value="1">تومان (بدون تبدیل)</option></select><span className="mt-1 block text-xs text-slate-500">واحد مبلغ در راهنمای عمومی صریح نشده؛ این گزینه را با قرارداد پذیرنده خود تطبیق دهید.</span></label> : key === "digipayPreferredGateway" ? <label key={key} className="block text-sm">روش پرداخت پیش‌فرض<select className="input mt-1" value={String(value(key))} onChange={(e) => set(key, Number(e.target.value))}><option value="2">پرداخت اینترنتی (IPG)</option><option value="0">کیف پول دیجی‌پی</option></select></label> : <label key={key} className="block text-sm">{label}<input className="input mt-1" type={key.toLowerCase().includes("secret") || key.toLowerCase().includes("password") || key.toLowerCase().includes("apikey") ? "password" : "text"} autoComplete="new-password" value={String(value(key))} placeholder={["torobpayClientSecret", "torobpayPassword", "nextpayApiKey", "digipayClientSecret", "digipayPassword", "snappayClientSecret", "snappayPassword", "behpardakhtPassword", "pasargadPassword", "vandarApiKey"].includes(key) && Number(value(`${key}Configured`)) ? "مقدار ذخیره شده است؛ برای حفظ آن خالی بگذارید" : key === "snappayApiBaseUrl" ? "https://دامنه‌ای که اسنپ‌پی به پذیرنده داده است" : ""} onChange={(e) => set(key, e.target.value)} /></label>)}
        {item.icon && <label className="block text-sm">شناسه فایل آیکن از مرکز فایل <input className="input mt-1" type="number" min="0" value={Number(value(item.icon)) || 0} onChange={(e) => set(item.icon!, Number(e.target.value))} /><span className="mt-1 block text-xs text-slate-500">برای حذف آیکن، شناسه را ۰ قرار دهید. فایل تصویری را از <a className="font-bold text-emerald-700 underline" href="/admin/media" target="_blank" rel="noreferrer">مرکز فایل</a> بارگذاری و شناسه آن را وارد کنید.</span></label>}
      </div>
      <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">{item.icon && <><span className="mb-3 text-xs font-bold text-slate-500">پیش‌نمایش آیکن درگاه</span>{Number(value(item.icon)) > 0 ? <img className="h-16 w-16 rounded-xl bg-white object-contain p-2 shadow-sm" src={`/api/media/${Number(value(item.icon))}`} alt={`آیکن ${item.title}`} /> : <span className="grid h-16 w-16 place-items-center rounded-xl bg-white text-sm font-black text-amber-800 shadow-sm">{item.title.slice(0, 2)}</span>}</>}<b className="mt-2">{item.title}</b><span className="mt-1 text-xs text-slate-500">{Number(value(item.enabled)) === 1 ? "فعال و قابل انتخاب" : "غیرفعال"}</span>{item.id === "nextpay" && <p className="mt-3 text-xs leading-6 text-slate-500">مبلغ به تومان ارسال می‌شود؛ برای پرداخت واقعی، کلید API معتبر پذیرنده را وارد کنید.</p>}{item.id === "digipay" && <p className="mt-3 text-xs leading-6 text-slate-500">مبلغ، تراکنش و نتیجهٔ پرداخت سمت سرور با API دیجی‌پی بررسی می‌شود. قبل از فعال‌سازی، محیط و واحد مبلغ را با اطلاعات پذیرنده تطبیق دهید.</p>}{item.id === "snappay" && <p className="mt-3 text-xs leading-6 text-slate-500">دامنه و اطلاعات پذیرنده را مطابق قرارداد اسنپ‌پی وارد کنید. اسنپ‌پی فقط سفارش‌هایی را نمایش می‌دهد که سرویس eligibility تأیید کند؛ مبلغ درخواست‌ها به ریال است و آدرس بازگشت باید نزد اسنپ‌پی ثبت شده باشد.</p>}{item.id === "behpardakht" && <p className="mt-3 text-xs leading-6 text-slate-500">مبلغ از تومان به ریال تبدیل می‌شود؛ نشانی callback باید روی دامنهٔ تأییدشدهٔ پذیرنده باشد و IP ثابت سرور نیز باید نزد به‌پرداخت ثبت شده باشد.</p>}{item.id === "manual" && <p className="mt-3 text-xs leading-6 text-slate-500">در صورت فعال‌بودن، روش ارسال فیش کارت‌به‌کارت یا حواله در سبد خرید و صفحه پرداخت سفارش در دسترس مشتری خواهد بود.</p>}</div>
    </div>)}
  </section>;
}
