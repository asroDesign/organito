import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { SitePageBlock } from "@/db/schema";
import type { SettingsShape } from "@/lib/settings";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { siteBrandText } from "@/lib/brand";
import { PublicSiteBlockContent } from "./PublicSiteBlockContent";

export type SitePageData = {
  title: string;
  slug: string;
  template: string;
  summary: string | null;
  blocks: SitePageBlock[];
  metaTitle: string | null;
  metaDescription: string | null;
  status: string;
};

export async function SitePageRenderer({ page, settings, embedded = false }: { page: SitePageData; settings: SettingsShape; embedded?: boolean }) {
  const brandedPage = JSON.parse(JSON.stringify(page, (_key, value) => typeof value === "string" ? siteBrandText(value, settings.siteName) : value)) as SitePageData;
  const maxWidth = page.template === "editorial" ? "max-w-4xl" : page.template === "minimal" ? "max-w-3xl" : "max-w-6xl";
  const contacts = [
    { Icon: MapPin, title: "نشانی", value: settings.senderAddress },
    { Icon: Phone, title: "تلفن", value: settings.supportPhone },
    { Icon: Mail, title: "ایمیل", value: settings.supportEmail },
    { Icon: Clock, title: "ساعات پاسخگویی", value: settings.supportHours },
  ];
  const Wrapper = embedded ? "div" : "main";
  return <>
    {!embedded && <SiteHeader />}
    <Wrapper className={embedded ? "mx-auto max-w-7xl space-y-8 px-4" : maxWidth + " relative mx-auto space-y-9 px-4 py-8 sm:py-12"}>
      {!embedded && <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-0 -z-10 size-64 rounded-full bg-amber-200/30 blur-3xl" />}
      {brandedPage.summary && <p className="sr-only">{brandedPage.summary}</p>}
      {brandedPage.blocks.map((block, index) => <PublicSiteBlockContent key={block.id || index} block={block} primary={index === 0}/>) }
      {page.template === "contact" && <section className="overflow-hidden rounded-[2rem] border border-emerald-950/5 bg-white p-5 shadow-[0_20px_70px_-55px_rgba(15,23,42,.5)] sm:p-7">
        <div className="mb-5"><span className="text-xs font-bold text-amber-700">راه‌های ارتباطی</span><h2 className="mt-1 text-xl font-black sm:text-2xl">پاسخ‌گو و همراه شما هستیم</h2></div>
        <div className="grid gap-3 sm:grid-cols-2">{contacts.map(({ Icon, title, value }) => <div key={title} className="flex min-w-0 items-center gap-4 rounded-2xl border border-slate-100 bg-gradient-to-l from-stone-50 to-white p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon className="size-5" /></span><div className="min-w-0"><small className="block text-slate-500">{title}</small><b className="mt-1 block break-words text-sm text-slate-900">{value || "اطلاعاتی ثبت نشده"}</b></div></div>)}</div>
      </section>}
    </Wrapper>
    {!embedded && <SiteFooter />}
  </>;
}
