import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Img } from "@/components/ui";
import { categoriesWithCounts } from "@/lib/queries";
import { faNum } from "@/lib/util";

export const metadata = { title: "دسته‌بندی محصولات" };

export default async function Categories() {
  const cats = await categoriesWithCounts();
  const roots = cats.filter((c) => !c.parent_id);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <nav className="mb-2 text-xs text-slate-500"><Link href="/">خانه</Link> / دسته‌بندی‌ها</nav>
        <h1 className="mb-6 text-2xl font-black">دسته‌بندی محصولات ارگانیک</h1>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((c) => {
            const kids = cats.filter((x) => x.parent_id === c.id);
            return (
              <div key={c.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:shadow-xl">
                <Link href={`/shop?cat=${c.id}`} className="relative block h-40 overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-100">
                  <Img id={c.img} alt={c.name} className="h-full w-full opacity-90 transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                  <div className="absolute bottom-3 right-4 text-white"><b className="text-xl">{c.name}</b><div className="text-xs opacity-80">{faNum(c.n)} کالا</div></div>
                </Link>
                <div className="space-y-2 p-4">
                  {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
                  {kids.length > 0 && <div className="flex flex-wrap gap-1.5">{kids.map((k) => <Link key={k.id} href={`/shop?cat=${k.id}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs hover:bg-emerald-100">{k.name} ({faNum(k.n)})</Link>)}</div>}
                  <Link href={`/shop?cat=${c.id}`} className="flex items-center gap-1 text-sm font-bold text-emerald-700">مشاهده محصولات<ArrowLeft className="h-4 w-4" /></Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
