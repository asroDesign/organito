"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Truck, Package, AlertTriangle, Minus, Plus } from "lucide-react";
import { api, toast, uid, useCart, writeCart, type CartItem } from "./client";
import type { Quote } from "@/lib/services/orders";

const t = (n: number) => `${n.toLocaleString("fa-IR")} تومان`;
const keyOf = (i: { productId: number; offerId: number | null; variantId: number | null }) => `${i.productId}:${i.offerId ?? 0}:${i.variantId ?? 0}`;

export function CartView({ loggedIn, defaultName, defaultPhone }: { loggedIn: boolean; defaultName: string; defaultPhone: string }) {
  const cart = useCart();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const idem = useRef(uid());
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("تهران");
  const [cityQ, setCityQ] = useState("تهران");
  const [carrierId, setCarrierId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [payMethod, setPayMethod] = useState<"gateway" | "manual">("gateway");
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
            {!g.sellerId && quote.carriers.length > 0 && (
              <div className="border-b bg-emerald-50/40 px-4 py-3">
                <div className="mb-2 text-xs font-bold text-slate-600">انتخاب شرکت پستی (بر اساس شهر مقصد «{quote.city || "—"}» و وزن):</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {quote.carriers.map((c) => (
                    <label key={c.id} className={`flex cursor-pointer items-center justify-between rounded-xl border bg-white p-2.5 text-sm ${quote.carrierId === c.id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                      <span className="flex items-center gap-2"><input type="radio" checked={quote.carrierId === c.id} onChange={() => setCarrierId(c.id)} /><span><b>{c.name}</b><div className="text-[11px] text-slate-500">تحویل {c.minDays.toLocaleString("fa-IR")} تا {c.maxDays.toLocaleString("fa-IR")} روز کاری</div></span></span>
                      <b className={c.cost === 0 ? "text-emerald-600" : ""}>{c.cost === 0 ? "رایگان" : t(c.cost)}</b>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
        <b>خلاصه سفارش</b>
        {quote && (
          <div className="space-y-2 text-sm">
            <Row k="جمع اقلام" v={t(quote.itemsSubtotal)} />
            <Row k="ارسال فروشندگان" v={t(quote.sellerShippingTotal)} />
            <Row k="ارسال انبار مرکزی" v={t(quote.centralShipping)} />
            <Row k="مالیات" v={t(quote.tax)} />
            {quote.festivalDiscount > 0 && <Row k="تخفیف جشنواره" v={`- ${t(quote.festivalDiscount)}`} />}
            {quote.codeDiscount > 0 && <Row k={`کد تخفیف (${quote.code?.code})`} v={`- ${t(quote.codeDiscount)}`} />}
            {quote.creditAmount>0&&<Row k="کارت هدیه / اعتبار خرید" v={`- ${t(quote.creditAmount)}`}/>}
            <div className="flex justify-between border-t pt-2 text-base font-extrabold"><span>مبلغ نهایی</span><span className="text-emerald-700">{t(quote.finalTotal)}</span></div>
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
            const fd = new FormData(e.currentTarget);
            setPlacing(true);
            try {
              const r = await api<{ id: number;paid:boolean }>("/api/orders", "POST", { items: cart.map(({ productId, offerId, variantId, qty }) => ({ productId, offerId, variantId, qty })), address: Object.fromEntries(fd), idempotencyKey: idem.current, code: quote?.code?.ok ? code : "", carrierId: quote?.carrierId });
              writeCart([]);
              if (payMethod === "gateway"&&!r.paid) {
                toast("سفارش ثبت شد؛ در حال انتقال به درگاه زرین‌پال…");
                try { const g = await api<{ url: string }>(`/api/orders/${r.id}/gateway`, "POST", {}); window.location.href = g.url; return; }
                catch (ge) { toast(`اتصال به درگاه ناموفق بود: ${(ge as Error).message}. از صفحه سفارش دوباره تلاش کنید.`, false); }
              } else toast(r.paid?"سفارش با اعتبار خرید تسویه شد":"سفارش ثبت شد؛ اطلاعات کارت به کارت را در صفحه سفارش ثبت کنید");
              router.push(`/customer/orders/${r.id}`);
            } catch (e2) { toast((e2 as Error).message, false); idem.current = uid(); } finally { setPlacing(false); }
          }}>
            <input name="fullName" required defaultValue={defaultName} placeholder="نام تحویل‌گیرنده" className="input" />
            <input name="phone" required defaultValue={defaultPhone} placeholder="موبایل" className="input" />
            <div className="grid grid-cols-2 gap-2"><input name="city" required placeholder="شهر" value={city} onChange={(e) => setCity(e.target.value)} className="input" /><input name="postalCode" placeholder="کد پستی" className="input" /></div>
            <textarea name="address" required minLength={10} placeholder="آدرس کامل" className="input min-h-20" />
            <div className="space-y-2 pt-1">
              <b className="text-xs text-slate-600">روش پرداخت</b>
              {([["gateway", "پرداخت آنلاین — درگاه زرین‌پال", "همه کارت‌های عضو شتاب"], ["manual", "کارت به کارت / حواله بانکی", "ثبت فیش پس از ثبت سفارش؛ پردازش پس از تأیید مالی"]] as const).map(([k, l, d]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-sm ${payMethod === k ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                  <input type="radio" className="mt-1" checked={payMethod === k} onChange={() => setPayMethod(k)} /><span><b>{l}</b><div className="text-[11px] text-slate-500">{d}</div></span>
                </label>
              ))}
            </div>
            {quote && !quote.valid && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">برخی اقلام سبد قابل خرید نیستند؛ آن‌ها را اصلاح یا حذف کنید.</div>}
            <button disabled={placing || loading || !quote?.valid} className="btn-primary w-full">{placing && <Loader2 className="h-4 w-4 animate-spin" />}{payMethod === "gateway" ? "ثبت سفارش و پرداخت" : "ثبت سفارش"}{quote?.valid ? ` — ${quote.finalTotal.toLocaleString("fa-IR")} تومان` : ""}</button>
          </form>
        )}
      </aside>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span className="text-slate-500">{k}</span><span>{v}</span></div>;
