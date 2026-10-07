"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Truck, Package, AlertTriangle, Minus, Plus, MapPin, X, PlusCircle, Store } from "lucide-react";
import { api, toast, uid, useCart, writeCart, type CartItem } from "./client";
import type { Quote } from "@/lib/services/orders";
import type { PaymentGatewayOption, GatewayId } from "@/lib/payment-gateways";
import { toman } from "@/lib/util";
import { CustomerIdentityForm, type CustomerIdentity } from "./CustomerIdentityForm";
import { trackAnalyticsEvent } from "@/lib/analytics-client";

const t = (n: number) => toman(n);
const keyOf = (i: { productId: number; offerId: number | null; variantId: number | null; selectedOptions?: Record<string, string | string[]> }) => `${i.productId}:${i.offerId ?? 0}:${i.variantId ?? 0}:${JSON.stringify(i.selectedOptions ?? {})}`;
const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false, loading: () => <div className="skeleton h-56 rounded-xl" /> });

type SavedAddress = { id:number; title:string; receiverName:string; receiverPhone:string; city:string; address:string; postalCode:string|null; latitude:string|null; longitude:string|null; isDefault:boolean };
type PickupCenter = { id:number; name:string; slug:string; city:string; address:string; phone:string|null; latitude:string|null; longitude:string|null; openingHours:{day:number;open:string;close:string;closed?:boolean}[]; dailyCapacity:number };
const tehranDate = (offset:number) => { const now=new Date(); const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now); const date=new Date(`${parts.find(x=>x.type==="year")!.value}-${parts.find(x=>x.type==="month")!.value}-${parts.find(x=>x.type==="day")!.value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10) };
const pickupDatesFor=(center:PickupCenter|null)=>Array.from({length:14},(_,index)=>tehranDate(index+1)).filter(date=>{const day=new Date(`${date}T12:00:00Z`).getUTCDay();return center?.openingHours.some(hour=>hour.day===day&&!hour.closed)});
const firstPickupTime=(center:PickupCenter|null,date:string)=>{if(!center)return "";const day=new Date(`${date}T12:00:00Z`).getUTCDay(),hours=center.openingHours.find(hour=>hour.day===day&&!hour.closed);if(!hours)return "";return Array.from({length:48},(_,index)=>`${String(Math.floor(index/2)).padStart(2,"0")}:${index%2?"30":"00"}`).find(time=>time>=hours.open&&time<hours.close)??""};
export function CartView({ loggedIn, defaultName, defaultPhone, savedAddresses=[], paymentGateway="zarinpal", paymentGateways=[], manualPaymentEnabled=true, initialProfile }: { loggedIn: boolean; defaultName: string; defaultPhone: string; savedAddresses?:SavedAddress[]; paymentGateway?: string; paymentGateways?: PaymentGatewayOption[]; manualPaymentEnabled?: boolean; initialProfile?:CustomerIdentity }) {
  const cart = useCart();
  const router = useRouter();
  const recoveryKey = useRef(uid());
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
  const [freightCollect, setFreightCollect] = useState(false);
  const [err, setErr] = useState("");
  const [payMethod, setPayMethod] = useState<"gateway" | "manual">("gateway");
  const [selectedGateway, setSelectedGateway] = useState<GatewayId>((paymentGateways[0]?.id ?? paymentGateway) as GatewayId);
  const [torobEligible, setTorobEligible] = useState<boolean | null>(null);
  const [checkingTorob, setCheckingTorob] = useState(false);
  const [snapOffer, setSnapOffer] = useState<{ eligible: boolean; titleMessage: string; description: string } | null>(null);
  const [checkingSnap, setCheckingSnap] = useState(false);
  const [selectedAddress,setSelectedAddress]=useState<SavedAddress|null>(savedAddresses.find(a=>a.isDefault)??savedAddresses[0]??null);
  const [addressModal,setAddressModal]=useState(false);
  const [savingAddress,setSavingAddress]=useState(false);
  const [addressError,setAddressError]=useState("");
  const [customerProfile,setCustomerProfile]=useState<CustomerIdentity>(initialProfile??{name:defaultName,email:null,birthdate:null,nationalId:null,companyName:null,companyNationalId:null,companyManager:null,smsConsent:false});
  const [requestOfficialInvoice,setRequestOfficialInvoice]=useState(false);
  const [officialInvoiceType,setOfficialInvoiceType]=useState<"individual"|"company">("individual");
  const [profileModal,setProfileModal]=useState(false);
  const [mapLocation,setMapLocation]=useState<[number,number]>([35.6892,51.389]);
  const [fulfillmentType,setFulfillmentType]=useState<"delivery"|"pickup">("delivery");
  const [pickupCenters,setPickupCenters]=useState<PickupCenter[]>([]);
  const [pickupCenterId,setPickupCenterId]=useState<number|null>(null);
  const [pickupDate,setPickupDate]=useState(tehranDate(1));
  const [pickupTime,setPickupTime]=useState("");
  useEffect(()=>{void api<PickupCenter[]>("/api/pickup-centers","GET").then(rows=>{setPickupCenters(rows);const first=rows[0]??null;setPickupCenterId(first?.id??null);const date=pickupDatesFor(first)[0]??tehranDate(1);setPickupDate(date);setPickupTime(firstPickupTime(first,date))}).catch(()=>setPickupCenters([]))},[]);
  useEffect(() => { const t = setTimeout(() => setCityQ(city), 500); return () => clearTimeout(t); }, [city]);
  useEffect(() => {
    if (!cart.length) { setQuote(null); setLoading(false); return; }
    setLoading(true);
    api<Quote>("/api/cart/quote", "POST", { items: cart, code, city: fulfillmentType==="pickup"?(pickupCenters.find(c=>c.id===pickupCenterId)?.city??cityQ):cityQ, carrierId, freightCollect, pickup: fulfillmentType==="pickup" }).then((q) => {
      setQuote(q);
      if (code && q.code && !q.code.ok) toast(q.code.error ?? "کد نامعتبر", false);
      setErr("");
    }).catch((e) => { setErr(e.message); toast(e.message, false); }).finally(() => setLoading(false));
  }, [cart, code, cityQ, carrierId, freightCollect, fulfillmentType, pickupCenterId, pickupCenters]);
  useEffect(() => {
    if (!paymentGateways.some((gateway) => gateway.id === "torobpay") || !quote?.valid || !quote.finalTotal) { setTorobEligible(null); return; }
    let current = true;
    setCheckingTorob(true); setTorobEligible(null);
    api<{ eligible: boolean; titleMessage: string; description: string }>("/api/payments/torobpay/eligible", "POST", { amount: quote.itemsSubtotal + quote.sellerShippingTotal + quote.centralShipping + quote.tax })
      .then((result) => { if (current) setTorobEligible(result.eligible); })
      .catch(() => { if (current) setTorobEligible(false); })
      .finally(() => { if (current) setCheckingTorob(false); });
    return () => { current = false; };
  }, [paymentGateways, quote?.finalTotal, quote?.valid]);
  useEffect(() => {
    if (!paymentGateways.some((gateway) => gateway.id === "snappay") || !quote?.valid || !quote.finalTotal) { setSnapOffer(null); return; }
    let current = true;
    setCheckingSnap(true); setSnapOffer(null);
    api<{ eligible: boolean; titleMessage: string; description: string }>("/api/payments/snappay/eligible", "POST", { amount: quote.finalTotal })
      .then((result) => { if (current) setSnapOffer(result); })
      .catch(() => { if (current) setSnapOffer({ eligible: false, titleMessage: "امکان پرداخت اسنپ‌پی بررسی نشد", description: "اتصال یا تنظیمات پذیرنده در دسترس نیست؛ روش‌های پرداخت دیگر همچنان قابل انتخاب‌اند." }); })
      .finally(() => { if (current) setCheckingSnap(false); });
    return () => { current = false; };
  }, [paymentGateways, quote?.finalTotal, quote?.valid]);
  const visibleGateways = paymentGateways.filter((gateway) => (gateway.id !== "torobpay" || torobEligible === true) && (gateway.id !== "snappay" || snapOffer?.eligible === true));
  useEffect(() => {
    if (visibleGateways.length && !visibleGateways.some((gateway) => gateway.id === selectedGateway)) setSelectedGateway(visibleGateways[0].id);
  }, [visibleGateways, selectedGateway]);
  useEffect(() => {
    if (!loggedIn || !cart.length) return;
    const timer = setTimeout(() => {
      void api("/api/cart/recovery", "POST", { recoveryKey: recoveryKey.current, items: cart.map(({ productId, variantId, offerId, qty, title, selectedOptions }) => ({ productId, variantId, offerId, qty, title, selectedOptions })) }).catch(() => null);
    }, 900);
    return () => clearTimeout(timer);
  }, [cart, loggedIn]);

  const requiredInvoiceProfileComplete = () => officialInvoiceType === "individual"
    ? /^\d{10}$/.test(normalizeDigits(customerProfile.nationalId??""))
    : !!customerProfile.companyName?.trim() && /^\d{11}$/.test(normalizeDigits(customerProfile.companyNationalId??"")) && !!customerProfile.companyManager?.trim();
  const pickupEligible = !!quote?.groups.length && quote.groups.every((group) => group.sellerId === null);
  const selectedPickupCenter = pickupCenters.find((center) => center.id === pickupCenterId) ?? null;
  const pickupDay = pickupDate ? new Date(`${pickupDate}T12:00:00Z`).getUTCDay() : -1;
  const pickupHours = selectedPickupCenter?.openingHours.find((hour) => hour.day === pickupDay && !hour.closed);
  const pickupTimes = pickupHours ? Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`).filter((time) => time >= pickupHours.open && time < pickupHours.close) : [];
  const pickupDates = Array.from({ length: 14 }, (_, index) => tehranDate(index + 1)).filter((date) => { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return selectedPickupCenter?.openingHours.some((hour) => hour.day === day && !hour.closed); });
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
                          {l.certifiedOrganic && <span className="rounded bg-emerald-700 px-2 py-0.5 font-bold text-white">{l.certificationLabel}</span>}
                          {l.partNumber && <span className="rounded border border-slate-200 px-2 py-0.5 font-mono text-slate-600" dir="ltr">PN: {l.partNumber}</span>}
                          {l.sku && <span className="rounded border border-slate-200 px-2 py-0.5 font-mono text-slate-500" dir="ltr">SKU: {l.sku}</span>}
                        </div>
                        {(l.variantTitle || Object.keys(l.attrs).length > 0) && (
                          <div className="flex flex-wrap gap-1.5 text-[11px]">{Object.keys(l.attrs).length ? Object.entries(l.attrs).map(([k, v]) => <span key={k} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">{k}: <b>{v}</b></span>) : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">{l.variantTitle}</span>}</div>
                        )}
                        <div className="text-[11px] text-slate-500">فروشنده: <b className="text-slate-700">{l.sellerName}</b>{l.warranty && <> · {l.warranty}</>}{l.ok && <> · <span className={l.allowBackorder && l.available < l.qty ? "font-bold text-amber-700" : l.available <= 3 ? "font-bold text-rose-600" : "text-emerald-600"}>{l.allowBackorder && l.available < l.qty ? "تأمین پس از سفارش" : l.available <= 3 ? `فقط ${l.available.toLocaleString("fa-IR")} عدد باقی مانده` : "موجود در انبار"}</span></>}</div>
                        {l.festivalPct > 0 && <div className="text-[11px] font-bold text-rose-600">🔥 {l.festivalTitle} — {l.festivalPct.toLocaleString("fa-IR")}٪ تخفیف {l.promotionKind === "variant" ? "تنوع" : "جشنواره"}</div>}
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
        <section className="space-y-2 border-b border-slate-100 pb-4"><b className="text-sm">روش دریافت سفارش</b><div className="grid gap-2 sm:grid-cols-2"><label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${fulfillmentType==="delivery"?"border-emerald-500 bg-emerald-50":"border-slate-200"}`}><input type="radio" name="fulfillment" checked={fulfillmentType==="delivery"} onChange={()=>{setFulfillmentType("delivery");setCarrierId(null)}}/><Truck className="size-4"/>ارسال به آدرس</label><label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${fulfillmentType==="pickup"?"border-amber-500 bg-amber-50":"border-slate-200"} ${!pickupEligible?"opacity-50":""}`}><input type="radio" name="fulfillment" checked={fulfillmentType==="pickup"} disabled={!pickupEligible||!pickupCenters.length} onChange={()=>{setFulfillmentType("pickup");setCarrierId(null);setFreightCollect(false)}}/><Store className="size-4"/>دریافت حضوری</label></div>{!pickupCenters.length&&<p className="text-[11px] text-slate-500">مرکز دریافت حضوری در حال حاضر تعریف نشده است.</p>}{quote?.groups.some(group=>group.sellerId!==null)&&<p className="text-[11px] text-amber-700">دریافت حضوری فقط برای کالاهای انبار مرکزی فعال است؛ سفارش‌های فروشندگان جداگانه ارسال می‌شوند.</p>}</section>
        {fulfillmentType==="delivery"&&loggedIn&&<section className="space-y-3 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between"><b className="flex items-center gap-2"><MapPin className="size-4 text-emerald-700"/>آدرس ارسال</b><button type="button" className="text-xs font-bold text-emerald-700" onClick={()=>{setAddressError("");setAddressModal(true)}}><PlusCircle className="ml-1 inline size-4"/>افزودن آدرس</button></div>
          {addresses.length>0&&<select className="input" value={selectedAddress?.id??""} onChange={e=>{const a=addresses.find(x=>x.id===Number(e.target.value))??null;setSelectedAddress(a);setCarrierId(null);setFreightCollect(false);if(a){setCity(a.city);setCityQ(a.city)}}}>{addresses.map(a=><option key={a.id} value={a.id}>{a.title} — {a.city}{a.isDefault?" (پیش‌فرض)":""}</option>)}</select>}
          {selectedAddress?<div className="rounded-xl bg-slate-50 p-3 text-xs leading-6"><div className="font-bold">{selectedAddress.receiverName} · <span dir="ltr">{selectedAddress.receiverPhone}</span></div><div>{selectedAddress.city}، {selectedAddress.address}</div>{selectedAddress.postalCode&&<div>کد پستی: {selectedAddress.postalCode}</div>}</div>:<button type="button" onClick={()=>setAddressModal(true)} className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">برای ادامه، آدرس ارسال را ثبت کنید</button>}
        </section>}
        {fulfillmentType==="pickup"&&<section className="space-y-3 border-b border-slate-100 pb-4"><b className="flex items-center gap-2 text-sm"><Store className="size-4 text-amber-700"/>مرکز و زمان دریافت</b>{pickupEligible&&selectedPickupCenter?<><select className="input" value={pickupCenterId??""} onChange={e=>{const center=pickupCenters.find(item=>item.id===Number(e.target.value))??null;const date=pickupDatesFor(center)[0]??tehranDate(1);setPickupCenterId(center?.id??null);setPickupDate(date);setPickupTime(firstPickupTime(center,date))}}>{pickupCenters.map(center=><option key={center.id} value={center.id}>{center.name} — {center.city}</option>)}</select><div className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950"><b>{selectedPickupCenter.name}</b><div>{selectedPickupCenter.city}، {selectedPickupCenter.address}</div>{selectedPickupCenter.phone&&<div>تلفن: <span dir="ltr">{selectedPickupCenter.phone}</span></div>}{selectedPickupCenter.latitude&&selectedPickupCenter.longitude&&<a className="font-bold underline" href={`https://www.openstreetmap.org/?mlat=${selectedPickupCenter.latitude}&mlon=${selectedPickupCenter.longitude}#map=16/${selectedPickupCenter.latitude}/${selectedPickupCenter.longitude}`} target="_blank" rel="noreferrer">مشاهده موقعیت روی نقشه</a>}<div>ساعت کاری روز انتخاب‌شده: {pickupHours?`${pickupHours.open} تا ${pickupHours.close}`:"تعطیل"}</div></div><div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-600">روز دریافت<select className="input mt-1" value={pickupDate} onChange={e=>{setPickupDate(e.target.value);setPickupTime(firstPickupTime(selectedPickupCenter,e.target.value))}}>{pickupDates.map(date=><option key={date} value={date}>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"full",timeZone:"Asia/Tehran"}).format(new Date(`${date}T12:00:00Z`))}</option>)}</select></label><label className="text-xs text-slate-600">ساعت دریافت<select className="input mt-1" value={pickupTime} onChange={e=>setPickupTime(e.target.value)}>{pickupTimes.map(time=><option key={time} value={time}>{time}</option>)}</select></label></div><p className="text-[11px] text-slate-500">هزینه ارسال صفر است. ظرفیت روزانه مرکز هنگام ثبت سفارش دوباره کنترل می‌شود.</p></>:<p className="text-xs text-amber-800">این سبد شرایط دریافت حضوری ندارد یا مرکزی برای دریافت فعال نیست.</p>}</section>}
        {fulfillmentType==="delivery"&&quote&&quote.carriers.length>0&&<section className="space-y-2 border-b border-slate-100 pb-4"><b className="flex items-center gap-2 text-sm"><Truck className="size-4 text-emerald-700"/>شرکت پستی و نوع ارسال</b><p className="text-[11px] text-slate-500">پس‌کرایه برای شرکت‌های پشتیبان به‌صورت خودکار اعمال می‌شود و هزینه ارسال در فاکتور نمی‌آید.</p><div className="grid gap-2">{quote.carriers.map(c=><label key={c.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${carrierId===c.id?"border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-100":"border-slate-200"}`}><span className="flex items-center gap-2"><input type="radio" name="shipping-option" checked={carrierId===c.id} onChange={()=>{setCarrierId(c.id);setFreightCollect(c.supportsFreightCollect)}}/><span><b className="block">{c.name}</b><span className="text-[11px] text-slate-500">تحویل {c.minDays.toLocaleString("fa-IR")} تا {c.maxDays.toLocaleString("fa-IR")} روز کاری</span></span></span><b className={c.supportsFreightCollect?"text-amber-800":""}>{c.supportsFreightCollect?"پس‌کرایه؛ پرداخت به پست":c.cost===0?"رایگان":t(c.cost)}</b></label>)}</div></section>}
        {fulfillmentType==="delivery"&&quote&&quote.lines.some(l=>l.ok)&&quote.carriers.length===0&&<section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><b className="flex items-center gap-2"><Truck className="size-4"/>شرکت پستی</b><p className="mt-1 text-xs leading-5">برای آدرس انتخاب‌شده شرکت پستی فعالی ثبت نشده است؛ تا فعال شدن گزینه ارسال، پرداخت امکان‌پذیر نیست.</p></section>}
        {loggedIn&&<section className="space-y-3 border-b border-slate-100 pb-4"><label className="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={requestOfficialInvoice} onChange={e=>{const enabled=e.target.checked;setRequestOfficialInvoice(enabled);if(enabled&&!requiredInvoiceProfileComplete())setProfileModal(true)}} className="mt-1 accent-emerald-700"/><span><b>درخواست فاکتور رسمی</b><small className="mt-1 block text-xs text-slate-500">مشخصات فاکتور از پروفایل شما ثبت می‌شود.</small></span></label>{requestOfficialInvoice&&<div className="space-y-2 pr-1"><div className="text-xs font-bold">نوع صورتحساب</div><label className="flex items-center gap-2 text-sm"><input type="radio" name="invoiceType" checked={officialInvoiceType==="individual"} onChange={()=>{setOfficialInvoiceType("individual");if(!/^\d{10}$/.test(normalizeDigits(customerProfile.nationalId??"")))setProfileModal(true)}}/>شخص حقیقی</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="invoiceType" checked={officialInvoiceType==="company"} onChange={()=>{setOfficialInvoiceType("company");if(!customerProfile.companyName||!/^\d{11}$/.test(normalizeDigits(customerProfile.companyNationalId??""))||!customerProfile.companyManager)setProfileModal(true)}}/>شخص حقوقی / شرکت</label><button type="button" className="text-xs font-bold text-emerald-700 underline" onClick={()=>setProfileModal(true)}>ویرایش اطلاعات صورتحساب در پروفایل</button>{!requiredInvoiceProfileComplete()&&<p className="text-xs text-rose-600">برای این نوع فاکتور، اطلاعات پروفایل کامل نیست.</p>}</div>}</section>}
        <b>جزئیات خرید</b>
        {quote && (
          <div className="space-y-2 text-sm">
            <Row k="جمع اقلام" v={t(quote.itemsSubtotal)} />
            <Row k="ارسال فروشندگان" v={fulfillmentType==="pickup"?"دریافت حضوری":t(quote.sellerShippingTotal)} />
            <Row k={fulfillmentType==="pickup"?"دریافت از مرکز":quote.freightCollect?"ارسال (پس‌کرایه)":"ارسال انبار مرکزی"} v={fulfillmentType==="pickup"?"رایگان":quote.freightCollect?"پس‌کرایه؛ پرداخت به شرکت پستی":t(quote.centralShipping)} />
            <Row k="مالیات" v={t(quote.tax)} />
            {quote.festivalDiscount > 0 && <Row k="تخفیف جشنواره" v={`- ${t(quote.festivalDiscount)}`} />}
            {quote.variantDiscount > 0 && <Row k="تخفیف زمان‌دار تنوع‌ها" v={`- ${t(quote.variantDiscount)}`} />}
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
            if(fulfillmentType==="delivery"&&!selectedAddress){setAddressError("ابتدا آدرس ارسال را انتخاب کنید");setAddressModal(true);return;}
            if(fulfillmentType==="delivery"&&quote?.lines.some(l=>l.ok)&&(!quote.carriers.length||!quote.carriers.some(c=>c.id===carrierId&&(!freightCollect||c.supportsFreightCollect)))){toast("ابتدا شرکت پستی و نوع ارسال معتبر را انتخاب کنید",false);return;}
            if(fulfillmentType==="pickup"&&(!pickupEligible||!pickupCenterId||!pickupDate||!pickupTime)){toast("مرکز، روز و ساعت دریافت را انتخاب کنید",false);return;}
            if(requestOfficialInvoice&&!requiredInvoiceProfileComplete()){setProfileModal(true);toast("برای صدور فاکتور رسمی، اطلاعات صورتحساب را در پروفایل کامل کنید",false);return;}
            trackAnalyticsEvent("checkout_started", undefined, "/cart");
            setPlacing(true);
            try {
              const r = await api<{ id: number;paid:boolean }>("/api/orders", "POST", { items: cart.map(({ productId, offerId, variantId, qty, selectedOptions }) => ({ productId, offerId, variantId, qty, selectedOptions })), address: fulfillmentType==="delivery"&&selectedAddress?{fullName:selectedAddress.receiverName,phone:selectedAddress.receiverPhone,city:selectedAddress.city,address:selectedAddress.address,postalCode:selectedAddress.postalCode??"",latitude:selectedAddress.latitude??"",longitude:selectedAddress.longitude??""}:{fullName:defaultName,phone:defaultPhone,city:"",address:"",postalCode:""}, fulfillmentType, pickupCenterId:fulfillmentType==="pickup"?pickupCenterId:null,pickupDate:fulfillmentType==="pickup"?pickupDate:null,pickupTime:fulfillmentType==="pickup"?pickupTime:null, idempotencyKey: idem.current, recoveryKey: recoveryKey.current, code: quote?.code?.ok ? code : "", carrierId:fulfillmentType==="delivery"?carrierId:null, freightCollect:fulfillmentType==="delivery"&&freightCollect, requestOfficialInvoice, officialInvoiceType });
              writeCart([]);
              if (payMethod === "gateway"&&!r.paid) {
                const selected = paymentGateways.find((gateway) => gateway.id === selectedGateway);
                toast(`سفارش ثبت شد؛ در حال انتقال به درگاه ${selected?.label ?? (paymentGateway === "zibal" ? "زیبال" : "زرین‌پال")}…`);
                try { const g = await api<{ url: string }>(`/api/orders/${r.id}/gateway`, "POST", { provider: selectedGateway }); window.location.href = g.url; return; }
                catch (ge) { toast(`اتصال به درگاه ناموفق بود: ${(ge as Error).message}. از صفحه سفارش دوباره تلاش کنید.`, false); }
              } else toast(r.paid?"سفارش با کیف پول تسویه شد":"سفارش ثبت شد؛ اطلاعات کارت به کارت را در صفحه سفارش ثبت کنید");
              router.push(`/customer/orders/${r.id}`);
            } catch (e2) { toast((e2 as Error).message, false); idem.current = uid(); } finally { setPlacing(false); }
          }}>
            <div className="space-y-2 pt-1">
              <b className="text-xs text-slate-600">روش پرداخت</b>
              {visibleGateways.map((gateway) => <label key={gateway.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${payMethod === "gateway" && selectedGateway === gateway.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                <input type="radio" name="payment-gateway" checked={payMethod === "gateway" && selectedGateway === gateway.id} onChange={() => { setSelectedGateway(gateway.id); setPayMethod("gateway"); }} />
                {gateway.iconId > 0 ? <img src={`/api/media/${gateway.iconId}`} alt={`آیکن ${gateway.label}`} className="h-9 w-9 rounded-lg bg-white object-contain p-1" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-[10px] font-black text-amber-900">{gateway.label.slice(0, 2)}</span>}
                <span><b>پرداخت آنلاین با {gateway.label}</b><div className="text-[11px] text-slate-500">{gateway.id === "torobpay" || gateway.id === "snappay" ? "پرداخت اعتباری؛ شرایط خرید در لحظه بررسی می‌شود" : "پرداخت از همه کارت‌های عضو شتاب"}</div>{gateway.id === "snappay" && snapOffer?.eligible && <div className="mt-1 text-xs leading-5 text-slate-700"><b>{snapOffer.titleMessage}</b>{snapOffer.description && <div>{snapOffer.description}</div>}</div>}</span>
              </label>)}
              {checkingTorob && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">در حال بررسی امکان پرداخت ترب‌پی…</div>}
              {checkingSnap && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">در حال بررسی شرایط پرداخت اسنپ‌پی…</div>}
              {paymentGateways.some((gateway) => gateway.id === "torobpay") && torobEligible === false && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">ترب‌پی برای مبلغ فعلی یا حساب پذیرنده در دسترس نیست؛ سایر درگاه‌های فعال همچنان قابل انتخاب‌اند.</div>}
              {paymentGateways.some((gateway) => gateway.id === "snappay") && snapOffer?.eligible === false && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><b>{snapOffer.titleMessage}</b>{snapOffer.description && <div className="mt-1">{snapOffer.description}</div>}</div>}
              {manualPaymentEnabled && <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${payMethod === "manual" ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}><input type="radio" name="payment-gateway" className="mt-1" checked={payMethod === "manual"} onChange={() => setPayMethod("manual")} /><span><b>کارت به کارت / حواله بانکی</b><div className="text-[11px] text-slate-500">ثبت فیش پس از ثبت سفارش؛ پردازش پس از تأیید مالی</div></span></label>}
              {!visibleGateways.length && !manualPaymentEnabled && !checkingTorob && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">در حال حاضر روش پرداختی فعال نیست.</div>}
            </div>
            {quote && !quote.valid && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">برخی اقلام سبد قابل خرید نیستند؛ آن‌ها را اصلاح یا حذف کنید.</div>}
        <button disabled={placing || loading || !quote?.valid || (fulfillmentType==="delivery"&&!selectedAddress) || (fulfillmentType==="pickup"&&(!pickupEligible||!pickupCenterId||!pickupDate||!pickupTime)) || (payMethod === "gateway" && !visibleGateways.some((gateway) => gateway.id === selectedGateway)) || (fulfillmentType==="delivery"&&Boolean(quote?.lines.some(l=>l.ok)&&(!quote.carriers.length||!quote.carriers.some(c=>c.id===carrierId&&(!freightCollect||c.supportsFreightCollect)))))} className="btn-primary w-full">{placing && <Loader2 className="h-4 w-4 animate-spin" />}{payMethod === "gateway" ? "ثبت سفارش و پرداخت" : "ثبت سفارش"}{quote?.valid ? ` — ${quote.finalTotal.toLocaleString("fa-IR")} تومان` : ""}</button>
          </form>
        )}
      </aside>
      {profileModal&&loggedIn&&<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5" role="dialog" aria-modal="true"><section className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">تکمیل پروفایل برای صورتحساب</h2><p className="mt-1 text-xs leading-6 text-slate-500">اطلاعات لازم را ذخیره کنید تا بتوانید درخواست فاکتور رسمی را ثبت کنید.</p></div><button type="button" className="btn-ghost" onClick={()=>setProfileModal(false)}><X className="size-4"/></button></div><CustomerIdentityForm initial={customerProfile} submitLabel="ذخیره پروفایل و ادامه" onSaved={value=>{setCustomerProfile(value);setProfileModal(false)}}/></section></div>}
      {addressModal&&loggedIn&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="cart-address-title"><div className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 id="cart-address-title" className="text-lg font-extrabold">{addresses.length?"افزودن آدرس جدید":"ثبت آدرس ارسال"}</h2><p className="mt-1 text-xs text-slate-500">پس از ذخیره، همین آدرس برای این سفارش انتخاب می‌شود.</p></div><button type="button" onClick={()=>setAddressModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="بستن"><X className="size-5"/></button></div>{addressError&&<div className="mb-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{addressError}</div>}<form className="grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();setSavingAddress(true);setAddressError("");const fd=new FormData(e.currentTarget);const values=Object.fromEntries(fd);try{const created=await api<SavedAddress>("/api/customer/addresses","POST",{...values,latitude:String(mapLocation[0]),longitude:String(mapLocation[1]),isDefault:addresses.length===0});setAddresses(old=>[...old,created]);setSelectedAddress(created);setCarrierId(null);setFreightCollect(false);setCity(created.city);setCityQ(created.city);setAddressModal(false);toast("آدرس ذخیره و برای سفارش انتخاب شد")}catch(error){setAddressError((error as Error).message)}finally{setSavingAddress(false)}}}><input name="title" className="input" placeholder="عنوان آدرس؛ مثل خانه یا محل کار" defaultValue={addresses.length?"":"خانه"} required/><input name="receiverName" className="input" placeholder="نام تحویل‌گیرنده" defaultValue={defaultName} required/><input name="receiverPhone" className="input" placeholder="موبایل تحویل‌گیرنده" defaultValue={defaultPhone} required/><input name="city" className="input" placeholder="شهر" defaultValue={city} onChange={e=>{setCity(e.target.value);setCityQ(e.target.value)}} required/><input name="postalCode" className="input sm:col-span-2" placeholder="کد پستی"/><textarea name="address" className="input min-h-20 sm:col-span-2" placeholder="نشانی کامل" minLength={8} required/><div className="sm:col-span-2"><div className="mb-2 text-sm font-bold">موقعیت روی نقشه (اختیاری)</div><MapPicker value={mapLocation} onChange={setMapLocation}/><div className="mt-1 text-xs text-slate-400">مختصات: {mapLocation[0].toFixed(5)}، {mapLocation[1].toFixed(5)}</div></div><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={()=>setAddressModal(false)}>انصراف</button><button disabled={savingAddress} className="btn-primary">{savingAddress&&<Loader2 className="size-4 animate-spin"/>}ذخیره و انتخاب آدرس</button></div></form></div></div>}
    </div>
  );
}
const normalizeDigits=(value:string)=>value.replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span className="text-slate-500">{k}</span><span>{v}</span></div>;
