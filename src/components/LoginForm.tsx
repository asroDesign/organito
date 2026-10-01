"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Leaf, Smartphone, KeyRound, ArrowRight, ShieldCheck, Pencil } from "lucide-react";
import { api } from "./client";
import { SiteBrand } from "./SiteBrand";

const DEMO: [string, string][] = [
  ["مدیر کل", "09120000001"], ["مدیر مارکت‌پلیس", "09120000002"], ["مدیر خرید و تأمین", "09120000003"], ["مدیر انبار", "09120000004"],
  ["حسابدار", "09120000005"], ["پشتیبان", "09120000006"], ["مدیر کاتالوگ", "09120000007"], ["مشتری (علی)", "09121111111"],
  ["مشتری (مریم)", "09122222222"], ["تولیدکننده ۱", "09123333331"], ["تولیدکننده ۲", "09123333332"], ["تولیدکننده ۳", "09123333333"],
];
const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function LoginForm({ siteName, siteLogoMediaId = 0 }: { siteName: string; siteLogoMediaId?: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", ""]);
  const [info, setInfo] = useState<{ isNew: boolean; canSellerSignup: boolean; devCode?: string } | null>(null);
  const [name, setName] = useState("");
  const [asSeller, setAsSeller] = useState(false);
  const [shop, setShop] = useState({ shopName: "", city: "" });
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const sellerIntent = () => new URLSearchParams(window.location.search).get("seller") === "1";

  useEffect(() => { if (timer <= 0) return; const t = setTimeout(() => setTimer(timer - 1), 1000); return () => clearTimeout(t); }, [timer]);
  const next = () => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : null; };

  const request = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api<{ isNew: boolean; canSellerSignup: boolean; devCode?: string }>("/api/auth/otp/request", "POST", { phone: toEn(phone), sellerIntent: sellerIntent() });
      setInfo(r); setStep("code"); setTimer(60); setDigits(r.devCode ? r.devCode.split("") : ["", "", "", "", ""]);
      setTimeout(() => refs.current[r.devCode ? 4 : 0]?.focus(), 50);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length !== 5) { setErr("کد ۵ رقمی را کامل وارد کنید"); return; }
    setBusy(true); setErr("");
    try {
      const referralCode = new URLSearchParams(window.location.search).get("ref") || "";
      const r = await api<{ redirect: string }>("/api/auth/otp/verify", "POST", { phone: toEn(phone), code, name, asSeller, sellerIntent: sellerIntent(), referralCode, ...shop });
      router.push(next() ?? r.redirect); router.refresh();
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const pwLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await api<{ redirect: string }>("/api/auth/login", "POST", { phone: toEn(phone), password }); router.push(next() ?? r.redirect); router.refresh(); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const setDigit = (i: number, v: string) => {
    const clean = toEn(v).replace(/\D/g, "");
    if (clean.length > 1) { const arr = clean.slice(0, 5).split(""); setDigits([...arr, ...Array(5 - arr.length).fill("")]); refs.current[Math.min(4, arr.length)]?.focus(); return; }
    const d = [...digits]; d[i] = clean; setDigits(d);
    if (clean && i < 4) refs.current[i + 1]?.focus();
  };
  const ready = digits.join("").length === 5 && (!info?.isNew || name.trim().length >= 2);

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl md:grid-cols-[1.1fr_1fr]">
      <div className="p-8 md:p-10">
        <Link href="/" className="mb-8 flex items-center gap-2"><SiteBrand name={siteName} logoMediaId={siteLogoMediaId}/><b className="text-2xl font-black text-emerald-950">{siteName}</b></Link>
        {mode === "otp" ? (
          step === "phone" ? (
            <form onSubmit={request} className="space-y-5">
              <div><h1 className="text-2xl font-black text-emerald-950">ورود یا ثبت‌نام</h1><p className="mt-1 text-sm text-slate-500">شماره موبایل خود را وارد کنید؛ کد تأیید پیامک می‌شود.</p></div>
              <div className="relative"><Smartphone className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" /><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoFocus required placeholder="09xxxxxxxxx" dir="ltr" className="input !h-14 !rounded-2xl !pr-12 text-center text-lg tracking-widest" /></div>
              {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
              <button disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-700 font-black text-white shadow-lg shadow-emerald-600/30">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 rotate-180" />}دریافت کد تأیید</button>
              <p className="text-center text-[11px] leading-6 text-slate-400">ورود شما به معنای پذیرش <Link href="/faq" className="underline">شرایط و قوانین</Link> {siteName} است.</p>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-5">
              <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="flex items-center gap-1 text-xs text-slate-500"><ArrowRight className="h-4 w-4" />بازگشت</button>
              <div><h1 className="text-2xl font-black text-emerald-950">کد تأیید را وارد کنید</h1><p className="mt-1 flex items-center gap-2 text-sm text-slate-500">کد ۵ رقمی به <b dir="ltr" className="text-slate-700">{toEn(phone)}</b> ارسال شد<button type="button" onClick={() => setStep("phone")} className="text-emerald-700"><Pencil className="h-3.5 w-3.5" /></button></p></div>
              {info?.devCode && <div className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">سرویس پیامک تنظیم نشده (محیط آزمایشی)؛ کد <b dir="ltr" className="font-mono text-base">{info.devCode}</b> به‌صورت خودکار وارد شد.</div>}
              <div className="flex justify-center gap-2" dir="ltr">
                {digits.map((d, i) => (
                  <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} inputMode="numeric" maxLength={5} autoComplete={i === 0 ? "one-time-code" : "off"}
                    onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }}
                    className={`h-14 w-12 rounded-2xl border-2 text-center text-2xl font-black outline-none transition ${d ? "border-emerald-500 bg-emerald-50" : "border-slate-200"} focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100`} />
                ))}
              </div>
              {info?.isNew && (
                <div className="space-y-3 rounded-2xl bg-[#faf7ef] p-4">
                  <b className="text-sm text-emerald-950">به {siteName} خوش آمدید! 🌿</b>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام و نام خانوادگی" className="input" />
                  {info.canSellerSignup && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asSeller} onChange={(e) => setAsSeller(e.target.checked)} />ثبت‌نام به‌عنوان تولیدکننده / فروشنده</label>}
                  {asSeller && <div className="grid grid-cols-2 gap-2"><input value={shop.shopName} onChange={(e) => setShop({ ...shop, shopName: e.target.value })} placeholder="نام فروشگاه / مزرعه" className="input" /><input value={shop.city} onChange={(e) => setShop({ ...shop, city: e.target.value })} placeholder="شهر" className="input" /></div>}
                </div>
              )}
              {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
              <button disabled={busy || !ready} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-700 font-black text-white shadow-lg shadow-emerald-600/30 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}{info?.isNew ? "تأیید و ثبت‌نام" : "تأیید و ورود"}</button>
              <div className="text-center text-sm">{timer > 0 ? <span className="text-slate-500">ارسال مجدد کد تا <b>{timer.toLocaleString("fa-IR")}</b> ثانیه دیگر</span> : <button type="button" onClick={() => request()} className="font-bold text-emerald-700">ارسال مجدد کد</button>}</div>
            </form>
          )
        ) : (
          <form onSubmit={pwLogin} className="space-y-4">
            <div><h1 className="text-2xl font-black text-emerald-950">ورود با رمز عبور</h1><p className="mt-1 text-sm text-slate-500">ویژه کارکنان و کاربرانی که رمز تعریف کرده‌اند.</p></div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="شماره موبایل" className="input !h-12" dir="ltr" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" placeholder="رمز عبور" className="input !h-12" dir="ltr" />
            {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
            <button disabled={busy} className="btn-primary h-12 w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}ورود</button>
          </form>
        )}
        <button type="button" onClick={() => { setMode(mode === "otp" ? "password" : "otp"); setStep("phone"); setErr(""); }} className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700">
          {mode === "otp" ? <><KeyRound className="h-3.5 w-3.5" />ورود با رمز عبور</> : <><Smartphone className="h-3.5 w-3.5" />ورود با کد یک‌بارمصرف</>}
        </button>
      </div>
      <div className="relative hidden flex-col justify-between bg-emerald-950 p-8 text-white md:flex">
        <div className="absolute inset-0 bg-[url('/images/hero-organic.jpg')] bg-cover bg-center opacity-20" />
        <div className="relative"><b className="text-2xl font-black leading-snug">طعم واقعی طبیعت،<br /><span className="text-lime-300">یک کد فاصله دارد.</span></b></div>
        <div className="relative">
          <b className="text-xs text-emerald-100">حساب‌های آزمایشی — روی هر مورد کلیک کنید (رمز: <code dir="ltr">Demo@1234</code>)</b>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {DEMO.map(([label, p]) => (
              <button key={p} type="button" onClick={() => { setPhone(p); setStep("phone"); if (mode === "password") setPassword("Demo@1234"); }} className="rounded-xl bg-white/10 p-2 text-right text-[11px] ring-1 ring-white/10 transition hover:bg-white/20">
                <div className="font-bold">{label}</div><div className="text-emerald-200/70" dir="ltr">{p}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
