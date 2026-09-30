import Link from "next/link";
import { BadgeCheck, ChevronDown, Flame, Headphones, LayoutDashboard, Leaf, Menu, PackageSearch, RotateCcw, ShoppingCart, Truck, User } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LiveSearch } from "./LiveSearch";
import { activeFestivals } from "@/lib/marketing";
import { categoriesWithCounts } from "@/lib/queries";
import { CartCount } from "./client";
import { Countdown } from "./Countdown";

export async function SiteHeader() {
  const [u, fests, cats, st] = await Promise.all([getUser(), activeFestivals(), categoriesWithCounts(), getSettings()]);
  const popular = ["عسل آویشن", "زعفران", "روغن زیتون", "گردو", "دمنوش"];
  const mv = !!st.multiVendor;
  const panel = u ? (u.sellerId ? "/seller" : u.staff ? "/admin" : "/customer") : "/login";
  const fest = fests[0];
  const roots = cats.filter((c) => !c.parent_id);
  return (
    <>
      <div className="hidden bg-emerald-950 text-[11px] text-emerald-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-lime-300" />تضمین ارگانیک بودن محصولات</span>
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-lime-300" />ارسال رایگان خرید بالای {(st.freeShippingOver / 1000000).toLocaleString("fa-IR")} میلیون تومان</span>
            <span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-lime-300" />{st.returnDays.toLocaleString("fa-IR")} روز مهلت بازگشت با تست آزمایشگاه</span>
          </div>
          <span className="flex items-center gap-1.5"><Headphones className="h-3.5 w-3.5 text-lime-300" />پشتیبانی <b dir="ltr">{st.supportPhone}</b> · {st.supportHours}</span>
        </div>
      </div>
      {fest && (
        <Link href="/shop?fest=1" className="block text-white" style={{ background: `linear-gradient(90deg, ${fest.color}, #0f172a)` }}>
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 text-xs sm:text-sm">
            <Flame className="h-4 w-4 animate-pulse" /><b>{fest.title}</b><span className="hidden sm:inline">تا {fest.discountPercent.toLocaleString("fa-IR")}٪ تخفیف</span>
            <span className="rounded bg-white/20 px-2 py-0.5">پایان: <Countdown to={fest.endsAt.toISOString()} compact /></span>
          </div>
        </Link>
      )}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-700 text-white shadow-lg shadow-lime-200"><Leaf className="h-5 w-5" /></span>
            <span className="hidden leading-tight sm:block"><b className="block text-xl font-black text-slate-900">سبزینه</b><span className="text-[10px] text-slate-500">مارکت‌پلیس ارگانیک</span></span>
          </Link>
          <div className="hidden flex-1 md:block"><LiveSearch popular={popular} /></div>
          <nav className="mr-auto flex items-center gap-1 md:mr-0">
            <Link href={u ? "/customer/tracking" : "/login"} className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 lg:flex"><Truck className="h-5 w-5" />پیگیری سفارش</Link>
            <Link href="/cart" className="relative rounded-xl p-2.5 text-slate-700 hover:bg-slate-100" aria-label="سبد خرید"><ShoppingCart className="h-6 w-6" /><CartCount /></Link>
            <Link href={panel} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">
              {u ? (u.avatarMediaId ? <img src={`/api/media/${u.avatarMediaId}`} alt="" className="h-6 w-6 rounded-full object-cover" /> : <LayoutDashboard className="h-5 w-5 text-emerald-600" />) : <User className="h-5 w-5" />}<span className="hidden sm:inline">{u ? u.name.split(" ")[0] : "ورود | ثبت‌نام"}</span>
            </Link>
          </nav>
        </div>
        <div className="px-4 pb-3 md:hidden"><LiveSearch compact popular={popular} /></div>
        <div className="hidden border-t border-slate-100 md:block">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 text-sm">
            <div className="group relative">
              <button className="flex items-center gap-2 py-3 pl-4 font-bold text-slate-800"><Menu className="h-4 w-4" />دسته‌بندی محصولات<ChevronDown className="h-4 w-4 transition group-hover:rotate-180" /></button>
              <div className="invisible absolute right-0 top-full z-50 w-[640px] translate-y-2 rounded-2xl border border-slate-200 bg-white p-4 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="grid grid-cols-3 gap-2">
                  {roots.map((c) => (
                    <div key={c.id} className="rounded-xl p-2 hover:bg-slate-50">
                      <Link href={`/shop?cat=${c.id}`} className="font-bold text-slate-800 hover:text-emerald-700">{c.name} <span className="text-xs font-normal text-slate-400">({c.n.toLocaleString("fa-IR")})</span></Link>
                      <div className="mt-1 space-y-0.5">{cats.filter((x) => x.parent_id === c.id).map((x) => <Link key={x.id} href={`/shop?cat=${x.id}`} className="block text-xs text-slate-500 hover:text-emerald-700">{x.name}</Link>)}</div>
                    </div>
                  ))}
                </div>
                <Link href="/categories" className="mt-3 block rounded-xl bg-emerald-50 py-2 text-center text-sm font-bold text-emerald-700">مشاهده همه دسته‌بندی‌ها</Link>
              </div>
            </div>
            <span className="h-5 w-px bg-slate-200" />
            <Link href="/shop?sort=discount" className="flex items-center gap-1 rounded-lg px-3 py-3 font-medium text-rose-600 hover:bg-rose-50"><Flame className="h-4 w-4" />تخفیف‌ها و جشنواره</Link>
            <Link href="/shop?sort=best" className="rounded-lg px-3 py-3 text-slate-600 hover:text-emerald-700">پرفروش‌ترین‌ها</Link>
            <Link href="/shop?sort=new" className="rounded-lg px-3 py-3 text-slate-600 hover:text-emerald-700">جدیدترین‌ها</Link>
            <Link href="/blog" className="rounded-lg px-3 py-3 text-slate-600 hover:text-emerald-700">مجله سبزینه</Link>
            <Link href="/customer/supply" className="flex items-center gap-1 rounded-lg px-3 py-3 text-slate-600 hover:text-emerald-700"><PackageSearch className="h-4 w-4" />سفارش ویژه</Link>
            {mv && !!st.allowSellerSignup && <Link href="/login?seller=1" className="rounded-lg px-3 py-3 text-slate-600 hover:text-emerald-700">تولیدکننده شوید</Link>}
            <Link href="/contact" className="mr-auto flex items-center gap-1 py-3 text-xs text-slate-500"><Headphones className="h-4 w-4" />پشتیبانی <span dir="ltr">021-91000000</span></Link>
          </div>
        </div>
      </header>
    </>
  );
}
