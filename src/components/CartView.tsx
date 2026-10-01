"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Truck, Package, AlertTriangle, Minus, Plus, MapPin, X, PlusCircle } from "lucide-react";
import { api, toast, uid, useCart, writeCart, type CartItem } from "./client";
import type { Quote } from "@/lib/services/orders";
import { toman } from "@/lib/util";

const t = (n: number) => toman(n);
const keyOf = (i: { productId: number; offerId: number | null; variantId: number | null }) => `${i.productId}:${i.offerId ?? 0}:${i.variantId ?? 0}`;
const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false, loading: () => <div className="skeleton h-56 rounded-xl" /> });

type SavedAddress = { id:number; title:string; receiverName:string; receiverPhone:string; city:string; address:string; postalCode:string|null; latitude:string|null; longitude:string|null; isDefault:boolean };
export function CartView({ loggedIn, defaultName, defaultPhone, savedAddresses=[], paymentGateway="zarinpal" }: { loggedIn: boolean; defaultName: string; defaultPhone: string; savedAddresses?:SavedAddress[]; paymentGateway?: string }) {
  const cart = useCart();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const idem = useRef(uid());
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [addresses,setAddresses]=useState(savedAddresses);
  const [city, setCity] = useState(savedAddresses.find(a=>a.isDefault)?.city??savedAddresses[0]?.city??"تهران");
  const [cityQ, setCityQ] = useState(savedAddresses.find(a=>a.isDefault)?.city??savedAddresses[0]?.city??"تهران");
  const [carrierId, setCarrierId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [payMethod, setPayMethod] = useState<"gateway" | "manual">("gateway");
  const [selectedAddress,setSelectedAddress]=useState<SavedAddress|null>(savedAddresses.find(a=>a.isDefault)??savedAddresses[0]??null);
  const [addressModal,setAddressModal]=useState(false);
  const [savingAddress,setSavingAddress]=useState(false);
  const [addressError,setAddressError]=useState("");
  const [mapLocation,setMapLocation]=useState<[number,number]>([35.6892,51.389]);
  useEffect(() => { const t = setTimeout(() => setCityQ(city), 500); return () => clearTimeout(t); }, [city]);
  useEffect(() => {
    if (!cart.length) { setQuote(null); setLoading(false); return; }
    setLoading(true);
    api<Quote>("/api/cart/quote", "POST", { items: cart, code, city: cityQ, carrierId }).then((q) => {
      setQuote(q);
      if (code && q.code && !q.code.ok) toast(q.code.error ?? "کد نامعتبر", false);
      setErr("");
    }).catch((e) => { setErr(e.message); toast(e.message, false); }).finally(() => setLoading(false));
  }, [cart, code, cityQ, carrierId]);

  const setQty = (it: CartItem, q: number) => writeCart(cart.map((c) => (keyOf(c) === keyOf(it) ? { ...c, qty: Math.max(1, Math.min(100, q)) } : c)));
  const remove = (k: string) => writeCart(cart.filter((c) => keyOf(c) !== k));
  const swap = (k: string, offerId: number, shop: string) => writeCart(cart.map((c) => (keyOf(c) === k ? { ...c, offerId, variantId: null, seller: shop } : c)));

  if (!cart.length) return <div className="rounded-2xl border border-dashed bg-white p-12 text-center"><Package className="mx-auto mb-2 h-12 w-12 text-slate-300" /><b>سبد خرید شما خالی است</b><div className="mt-3"><Link href="/shop" className="btn-primary">رفتن به فروشگاه</Link></div></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {err && !quote && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{err}<button className="mr-3 font-bold underline" onClick={() => writeCart([])}>خالی کردن سبد</button></div>}
        {loading && !quote && Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-40" />)}
        {quote?.groups.map((g) => (
          <section key={g.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-sm">
              <b className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-600" />مرسوله: {g.name}</b>
              <span className="text-xs text-slate-500">ارسال {t(g.shippingCost)} · آماده‌سازی {g.prepDays.toLocaleString("fa-IR")} روز · {g.packages.toLocaleString("fa-IR")} بسته · {(g.weight / 1000).toLocaleString("fa-IR")} کیلوگرم</span>
            </header>
            <ul className="divide-y">
              {g.lines.map((l) => {
                const item = cart.find((c) => keyOf(c) === l.key);
                return (
                  <li key={l.key} className="p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <Link href={`/products/${l.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                        {l.imageId ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/media/${l.imageId}`} alt={l.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-3xl">⚙️</div>}
                      </Link>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/products/${l.slug}`} className="line-clamp-2 text-sm font-bold leading-6 text-slate-900 hover:text-emerald-700">{l.title}</Link>
                          <button onClick={() => remove(l.key)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="حذف از سبد"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {l.brand && <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">{l.brand}</span>}
                          {l.authenticity && <span className={`rounded px-2 py-0.5 font-bold text-white ${l.authenticity === "Original" ? "bg-emerald-500" : l.authenticity === "OEM" ? "bg-emerald-500" : "bg-slate-500"}`}>{({ Original: "ارگانیک گواهی‌شده", OEM: "طبیعی", Aftermarket: "محلی و سنتی" } as Record<string, string>)[l.authenticity] ?? l.authenticity}</span>}
                          {l.partNumber && <span className="rounded border border-slate-200 px-2 py-0.5 font-mono text-slate-600" dir="ltr">PN: {l.partNumber}</span>}
                          {l.sku && <span className="rounded border border-slate-200 px-2 py-0.5 font-mono text-slate-500" dir="ltr">SKU: {l.sku}</span>}
                        </div>
                        {(l.variantTitle || Object.keys(l.attrs).length > 0) && (
                          <div className="flex flex-wrap gap-1.5 text-[11px]">{Object.keys(l.attrs).length ? Object.entries(l.attrs).map(([k, v]) => <span key={k} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">{k}: <b>{v}</b></span>) : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">{l.variantTitle}</span>}</div>
                        )}
                        <div className="text-[11px] text-slate-500">فروشنده: <b className="text-slate-700">{l.sellerName}</b>{l.warranty && <> · {l.warranty}</>}{l.ok && <> · <span className={l.available <= 3 ? "font-bold text-rose-600" : "text-emerald-600"}>{l.available <= 3 ? `فقط ${l.available.toLocaleString("fa-IR")} عدد باقی مانده` : "موجود در انبار"}</span></>}</div>
                        {l.festivalPct > 0 && <div className="text-[11px] font-bold text-rose-600">🔥 {l.festivalTitle} — {l.festivalPct.toLocaleString("fa-IR")}٪ تخفیف (در خلاصه سفارش اعمال شده)</div>}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {item ? (
                            <div className="flex items-center rounded-xl border border-slate-200">
                              <button className="p-2 disabled:opacity-30" disabled={item.qty <= 1} onClick={() => setQty(item, item.qty - 1)}><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-8 text-center text-sm font-bold">{item.qty.toLocaleString("fa-IR")}</span>
                              <button className="p-2 disabled:opacity-30" disabled={l.maxQty > 0 && item.qty >= l.maxQty} onClick={() => setQty(item, item.qty + 1)}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : <span />}
                          <div className="text-left">
                            <div className="text-[11px] text-slate-400">{t(l.unitPrice)} × {l.qty.toLocaleString("fa-IR")}</div>
                            {l.festivalPct > 0 && <s className="ml-1 text-xs text-slate-400">{l.lineTotal.toLocaleString("fa-IR")}</s>}
                            <b className="text-base text-slate-900">{t(l.lineTotal - Math.round((l.lineTotal * l.festivalPct) / 100))}</b>
                          </div>
                        </div>
                      </div>
                    </div>
                    {!l.ok && (
                      <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="flex items-center gap-1 font-bold"><AlertTriangle className="h-4 w-4" />{l.error} (موجود: {l.available.toLocaleString("fa-IR")})</div>
                        {l.alternatives.length > 0 ? <div className="mt-2 space-y-1"><div className="text-xs">پیشنهادهای جایگزین (انتخاب با شما):</div>{l.alternatives.slice(0, 3).map((a) => (
                          <button key={a.offerId} onClick={() => swap(l.key, a.offerId, a.shopName)} className="flex w-full justify-between rounded-lg bg-white px-3 py-2 text-xs hover:ring-2 hover:ring-amber-300"><span>{a.shopName} · آماده‌سازی {a.prepDays} روز</span><b>{t(a.price)}</b></button>
                        ))}</div> : <Link href="/customer/supply" className="text-xs underline">ثبت درخواست تأمین</Link>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <footer className="flex justify-between bg-slate-50/60 px-4 py-2 text-xs text-slate-600"><span>جمع اقلام: {t(g.itemsTotal)}</span><span>هزینه ارسال این فروشنده: {t(g.shippingCost)}</span></footer>
          </section>
        ))}
      </div>
      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-36">
        {loggedIn&&<section className="space-y-3 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between"><b className="flex items-center gap-2"><MapPin className="size-4 text-emerald-700"/>آدرس ارسال</b><button type="button" className="text-xs font-bold text-emerald-700" onClick={()=>{setAddressError("");setAddressModal(true)}}><PlusCircle className="ml-1 inline size-4"/>افزودن آدرس</button></div>
          {addresses.length>0&&<select className="input" value={selectedAddress?.id??""} onChange={e=>{const a=addresses.find(x=>x.id===Number(e.target.value))??null;setSelectedAddress(a);setCarrierId(null);if(a){setCity(a.city);setCityQ(a.city)}}}>{addresses.map(a=><option key={a.id} value={a.id}>{a.title} — {a.city}{a.isDefault?" (پیش‌فرض)":""}</option>)}</select>}
          {selectedAddress?<div className="rounded-xl bg-slate-50 p-3 text-xs leading-6"><div className="font-bold">{selectedAddress.receiverName} · <span dir="ltr">{selectedAddress.receiverPhone}</span></div><div>{selectedAddress.city}، {selectedAddress.address}</div>{selectedAddress.postalCode&&<div>کد پستی: {selectedAddress.postalCode}</div>}</div>:<button type="button" onClick={()=>setAddressModal(true)} className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">برای ادامه، آدرس ارسال را ثبت کنید</button>}
        </section>}
        {quote&&quote.carriers.length>0&&<section className="space-y-2 border-b border-slate-100 pb-4"><b className="flex items-center gap-2 text-sm"><Truck className="size-4 text-emerald-700"/>شرکت پستی</b><p className="text-[11px] text-slate-500">هزینه بر اساس آدرس «{quote.city||city}» و وزن مرسوله محاسبه شده؛ یکی را انتخاب کنید.</p><div className="grid gap-2">{quote.carriers.map(c=><label key={c.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-sm ${carrierId===c.id?"border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-100":"border-slate-200"}`}><span className="flex items-center gap-2"><input type="radio" name="carrier" checked={carrierId===c.id} onChange={()=>setCarrierId(c.id)}/><span><b>{c.name}</b><span className="block text-[11px] text-slate-500">تحویل {c.minDays.toLocaleString("fa-IR")} تا {c.maxDays.toLocaleString("fa-IR")} روز کاری</span></span></span><b className={c.cost===0?"text-emerald-600":""}>{c.cost===0?"رایگان":t(c.cost)}</b></label>)}</div></section>}
        {quote&&quote.lines.some(l=>l.ok)&&quote.carriers.length===0&&<section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><b className="flex items-center gap-2"><Truck className="size-4"/>شرکت پستی</b><p className="mt-1 text-xs leading-5">برای آدرس انتخاب‌شده شرکت پستی فعالی ثبت نشده است؛ تا فعال شدن گزینه ارسال، پرداخت امکان‌پذیر نیست.</p></section>}
        <b>جزئیات خرید</b>
        {quote && (
          <div className="space-y-2 text-sm">
            <Row k="جمع اقلام" v={t(quote.itemsSubtotal)} />
            <Row k="ارسال فروشندگان" v={t(quote.sellerShippingTotal)} />
            <Row k="ارسال انبار مرکزی" v={t(quote.centralShipping)} />
            <Row k="مالیات" v={t(quote.tax)} />
            {quote.festivalDiscount > 0 && <Row k="تخفیف جشنواره" v={`- ${t(quote.festivalDiscount)}`} />}
            {quote.codeDiscount > 0 && <Row k={`کد تخفیف (${quote.code?.code})`} v={`- ${t(quote.codeDiscount)}`} />}
            {quote.creditAmount>0&&<Row k="کارت هدیه / کیف پول" v={`- ${t(quote.creditAmount)}`}/>}
            <div className="flex justify-between border-t pt-2 text-base font-extrabold"><span>مبلغ نهایی</span><span className="text-emerald-700">{t(quote.finalTotal)}</span></div>
            {quote.carriers.length>0&&carrierId===null&&<p className="text-[11px] text-amber-700">مبلغ نمایش‌داده‌شده برآوردی است؛ هزینه ارسال پس از انتخاب شرکت پستی نهایی می‌شود.</p>}
            <p className="text-[11px] text-slate-400">قیمت و موجودی نهایی هنگام ثبت در سرور اعتبارسنجی می‌شود.</p>
          </div>
        )}
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          {code && quote?.code?.ok ? (
            <div className="flex items-center justify-between text-sm"><span className="text-emerald-700">✓ کد <b dir="ltr">{quote.code.code}</b> — {quote.code.title}</span><button className="text-xs text-rose-600" onClick={() => { setCode(""); setCodeInput(""); }}>حذف</button></div>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCode(codeInput.trim()); }}>
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="کد تخفیف، کارت هدیه یا WALLET" dir="ltr" className="input" />
              <button className="btn-ghost whitespace-nowrap">اعمال</button>
            </form>
          )}
          {code && quote?.code && !quote.code.ok && <div className="mt-1 text-xs text-rose-600">{quote.code.error}</div>}
        </div>
        {!loggedIn ? <Link href="/login?next=/cart" className="btn-primary w-full">برای ثبت سفارش وارد شوید</Link> : (
          <form className="space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            if(!selectedAddress){setAddressError("ابتدا آدرس ارسال را انتخاب کنید");setAddressModal(true);return;}
            if(quote?.lines.some(l=>l.ok)&&(!quote.carriers.length||!quote.carriers.some(c=>c.id===carrierId))){toast("ابتدا یک شرکت پستی فعال را انتخاب کنید",false);return;}
            setPlacing(true);
            try {
              const r = await api<{ id: number;paid:boolean }>("/api/orders", "POST", { items: cart.map(({ productId, offerId, variantId, qty }) => ({ productId, offerId, variantId, qty })), address: {fullName:selectedAddress.receiverName,phone:selectedAddress.receiverPhone,city:selectedAddress.city,address:selectedAddress.address,postalCode:selectedAddress.postalCode??"",latitude:selectedAddress.latitude??"",longitude:selectedAddress.longitude??""}, idempotencyKey: idem.current, code: quote?.code?.ok ? code : "", carrierId });
              writeCart([]);
              if (payMethod === "gateway"&&!r.paid) {
                toast(`سفارش ثبت شد؛ در حال انتقال به درگاه ${paymentGateway === "zibal" ? "زیبال" : "زرین‌پال"}…`);
                try { const g = await api<{ url: string }>(`/api/orders/${r.id}/gateway`, "POST", {}); window.location.href = g.url; return; }
                catch (ge) { toast(`اتصال به درگاه ناموفق بود: ${(ge as Error).message}. از صفحه سفارش دوباره تلاش کنید.`, false); }
              } else toast(r.paid?"سفارش با کیف پول تسویه شد":"سفارش ثبت شد؛ اطلاعات کارت به کارت را در صفحه سفارش ثبت کنید");
              router.push(`/customer/orders/${r.id}`);
            } catch (e2) { toast((e2 as Error).message, false); idem.current = uid(); } finally { setPlacing(false); }
          }}>
            <div className="space-y-2 pt-1">
              <b className="text-xs text-slate-600">روش پرداخت</b>
              {([["gateway", `پرداخت آنلاین — درگاه ${paymentGateway === "zibal" ? "زیبال" : "زرین‌پال"}`, "همه کارت‌های عضو شتاب"], ["manual", "کارت به کارت / حواله بانکی", "ثبت فیش پس از ثبت سفارش؛ پردازش پس از تأیید مالی"]] as const).map(([k, l, d]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-sm ${payMethod === k ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                  <input type="radio" className="mt-1" checked={payMethod === k} onChange={() => setPayMethod(k)} /><span><b>{l}</b><div className="text-[11px] text-slate-500">{d}</div></span>
                </label>
              ))}
            </div>
            {quote && !quote.valid && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">برخی اقلام سبد قابل خرید نیستند؛ آن‌ها را اصلاح یا حذف کنید.</div>}
            <button disabled={placing || loading || !quote?.valid || !selectedAddress || Boolean(quote?.lines.some(l=>l.ok)&&(!quote.carriers.length||!quote.carriers.some(c=>c.id===carrierId)))} className="btn-primary w-full">{placing && <Loader2 className="h-4 w-4 animate-spin" />}{payMethod === "gateway" ? "ثبت سفارش و پرداخت" : "ثبت سفارش"}{quote?.valid ? ` — ${quote.finalTotal.toLocaleString("fa-IR")} تومان` : ""}</button>
          </form>
        )}
      </aside>
      {addressModal&&loggedIn&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="cart-address-title"><div className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 id="cart-address-title" className="text-lg font-extrabold">{addresses.length?"افزودن آدرس جدید":"ثبت آدرس ارسال"}</h2><p className="mt-1 text-xs text-slate-500">پس از ذخیره، همین آدرس برای این سفارش انتخاب می‌شود.</p></div><button type="button" onClick={()=>setAddressModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="بستن"><X className="size-5"/></button></div>{addressError&&<div className="mb-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{addressError}</div>}<form className="grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();setSavingAddress(true);setAddressError("");const fd=new FormData(e.currentTarget);const values=Object.fromEntries(fd);try{const created=await api<SavedAddress>("/api/customer/addresses","POST",{...values,latitude:String(mapLocation[0]),longitude:String(mapLocation[1]),isDefault:addresses.length===0});setAddresses(old=>[...old,created]);setSelectedAddress(created);setCarrierId(null);setCity(created.city);setCityQ(created.city);setAddressModal(false);toast("آدرس ذخیره و برای سفارش انتخاب شد")}catch(error){setAddressError((error as Error).message)}finally{setSavingAddress(false)}}}><input name="title" className="input" placeholder="عنوان آدرس؛ مثل خانه یا محل کار" defaultValue={addresses.length?"":"خانه"} required/><input name="receiverName" className="input" placeholder="نام تحویل‌گیرنده" defaultValue={defaultName} required/><input name="receiverPhone" className="input" placeholder="موبایل تحویل‌گیرنده" defaultValue={defaultPhone} required/><input name="city" className="input" placeholder="شهر" defaultValue={city} onChange={e=>{setCity(e.target.value);setCityQ(e.target.value)}} required/><input name="postalCode" className="input sm:col-span-2" placeholder="کد پستی"/><textarea name="address" className="input min-h-20 sm:col-span-2" placeholder="نشانی کامل" minLength={8} required/><div className="sm:col-span-2"><div className="mb-2 text-sm font-bold">موقعیت روی نقشه (اختیاری)</div><MapPicker value={mapLocation} onChange={setMapLocation}/><div className="mt-1 text-xs text-slate-400">مختصات: {mapLocation[0].toFixed(5)}، {mapLocation[1].toFixed(5)}</div></div><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={()=>setAddressModal(false)}>انصراف</button><button disabled={savingAddress} className="btn-primary">{savingAddress&&<Loader2 className="size-4 animate-spin"/>}ذخیره و انتخاب آدرس</button></div></form></div></div>}
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span className="text-slate-500">{k}</span><span>{v}</span></div>;
