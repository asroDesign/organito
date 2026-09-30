import Link from "next/link";
import { Leaf, Phone, Mail, MapPin, Clock } from "lucide-react";
import { getSettings } from "@/lib/settings";

export async function SiteFooter() {
  const s = await getSettings();
  return (
    <footer className="mt-12 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><div className="flex items-center gap-2 text-white"><Leaf className="h-5 w-5 text-emerald-400" /><b className="text-lg">{s.siteName}</b></div><p className="text-sm leading-7">{s.siteTagline}. خرید مطمئن محصولات ارگانیک، طبیعی و محلی مستقیم از کشاورزان و تولیدکنندگان.</p></div>
        <div><b className="mb-3 block text-white">دسترسی سریع</b><ul className="space-y-1.5 text-sm"><li><Link href="/shop">فروشگاه</Link></li><li><Link href="/blog">مجله سبزینه</Link></li><li><Link href="/customer/supply">استعلام کد محصول</Link></li>{!!s.multiVendor && !!s.allowSellerSignup && <li><Link href="/login">تولیدکننده شوید</Link></li>}<li><Link href="/cart">سبد خرید</Link></li></ul></div>
        <div><b className="mb-3 block text-white">راهنما</b><ul className="space-y-1.5 text-sm"><li><Link href="/about">درباره ما</Link></li><li><Link href="/faq">سؤالات متداول</Link></li><li><Link href="/contact">تماس با ما</Link></li><li><Link href="/customer/tickets">ثبت تیکت پشتیبانی</Link></li></ul></div>
        <div className="space-y-2 text-sm"><b className="mb-3 block text-white">ارتباط با ما</b><div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{s.senderAddress}</div><div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span dir="ltr">{s.supportPhone}</span></div><div className="flex items-center gap-2"><Clock className="h-4 w-4" />{s.supportHours}</div><div className="flex items-center gap-2"><Mail className="h-4 w-4" />info@sabzineh.ir</div></div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs">© {s.siteName} — تمامی حقوق محفوظ است.</div>
    </footer>
  );
}
