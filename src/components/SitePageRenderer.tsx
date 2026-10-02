import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { SitePageBlock } from "@/db/schema";
import type { SettingsShape } from "@/lib/settings";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { siteBrandText } from "@/lib/brand";
import { SiteContentSlider } from "./SiteContentSlider";

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

export function SitePageRenderer({ page, settings, embedded = false }: { page: SitePageData; settings: SettingsShape; embedded?: boolean }) {
  const brandedPage = JSON.parse(JSON.stringify(page, (_key, value) => typeof value === "string" ? siteBrandText(value, settings.siteName) : value)) as SitePageData;
  const maxWidth = page.template === "editorial" ? "max-w-4xl" : page.template === "minimal" ? "max-w-3xl" : "max-w-6xl";
  const heroStyle = page.template === "editorial" ? "from-amber-100 to-orange-50 text-amber-950" : page.template === "minimal" ? "from-slate-100 to-white text-slate-950" : "from-emerald-700 to-slate-900 text-white";
  const contacts = [
    { Icon: MapPin, title: "نشانی", value: settings.senderAddress },
    { Icon: Phone, title: "تلفن", value: settings.supportPhone },
    { Icon: Mail, title: "ایمیل", value: settings.supportEmail },
    { Icon: Clock, title: "ساعات پاسخگویی", value: settings.supportHours },
  ];
  const Wrapper = embedded ? "div" : "main";
  return <>
    {!embedded && <SiteHeader />}
    <Wrapper className={embedded ? "mx-auto max-w-7xl space-y-7 px-4" : maxWidth + " mx-auto space-y-7 px-4 py-10"}>
      {brandedPage.summary && <p className="sr-only">{brandedPage.summary}</p>}
      {brandedPage.blocks.map((block, index) => {
        if (block.type === "hero") return <section key={index} className={"relative overflow-hidden rounded-[2rem] bg-gradient-to-l " + heroStyle + " p-7 sm:p-10"}>
          {block.mediaId ? <img src={"/api/media/" + block.mediaId} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" /> : null}
          <div className="relative max-w-3xl"><h1 className="text-3xl font-black leading-tight sm:text-5xl">{block.title || brandedPage.title}</h1>{block.body && <p className="mt-4 whitespace-pre-line text-base leading-8 opacity-90 sm:text-lg">{block.body}</p>}</div>
        </section>;
        if (block.type === "text") return <section key={index} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">{block.title && <h2 className="mb-3 text-2xl font-black text-emerald-950">{block.title}</h2>}<div className="whitespace-pre-line text-sm leading-8 text-slate-700 sm:text-base">{block.body}</div></section>;
        if (block.type === "image") return <section key={index}>{block.title && <h2 className="mb-2 text-2xl font-black text-emerald-950">{block.title}</h2>}{block.body && <p className="mb-4 whitespace-pre-line text-sm leading-7 text-slate-600">{block.body}</p>}<figure className="overflow-hidden rounded-3xl bg-slate-100">{block.mediaId ? <img src={"/api/media/" + block.mediaId} alt={block.caption || block.title || brandedPage.title} className="max-h-[600px] w-full object-cover" /> : <div className="grid min-h-48 place-items-center text-sm text-slate-500">تصویری برای این بخش انتخاب نشده است</div>}{block.caption && <figcaption className="p-3 text-center text-xs text-slate-500">{block.caption}</figcaption>}</figure></section>;
        if (block.type === "slider") return <SiteContentSlider key={index} title={block.title || "اسلایدهای فروشگاه"} body={block.body} items={block.items ?? []}/>;
        if (block.type === "grid") return <section key={index}><div className="mb-4"><h2 className="text-2xl font-black text-emerald-950">{block.title}</h2>{block.body && <p className="mt-2 text-sm leading-7 text-slate-600">{block.body}</p>}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(block.items ?? []).map((item, i) => <article key={i} className={"overflow-hidden rounded-2xl border p-5 shadow-sm " + (item.kind === "cta" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")}>{item.kind === "image" && item.mediaId && <img src={"/api/media/" + item.mediaId} alt={item.caption || item.title} className="mb-4 aspect-[16/10] w-full rounded-xl object-cover"/>}{item.kind === "image" && item.caption && <small className="mb-2 block text-center text-slate-500">{item.caption}</small>}{item.title && <h3 className="font-black text-emerald-950">{item.title}</h3>}{item.body && <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{item.body}</p>}{item.kind === "cta" && item.buttonLabel && item.href && <Link href={item.href} className="btn-primary mt-4">{item.buttonLabel}</Link>}</article>)}</div></section>;
        if (block.type === "features") return <section key={index}><h2 className="mb-4 text-2xl font-black text-emerald-950">{block.title}</h2><div className="grid gap-4 sm:grid-cols-2">{(block.items ?? []).map((item, i) => <article key={i} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><span className="mb-3 grid size-9 place-items-center rounded-xl bg-emerald-50 font-black text-emerald-700">{new Intl.NumberFormat("fa-IR").format(i + 1)}</span><h3 className="font-black">{item.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{item.body}</p></article>)}</div></section>;
        if (block.type === "faq") return <section key={index}><h2 className="mb-4 text-2xl font-black text-emerald-950">{block.title || "پرسش‌های متداول"}</h2><div className="space-y-3">{(block.items ?? []).map((item, i) => <details key={i} className="rounded-2xl border bg-white p-4"><summary className="cursor-pointer font-bold">{item.title}</summary><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{item.body}</p></details>)}</div></section>;
        if (block.type === "cta") return <section key={index} className="rounded-3xl bg-emerald-50 p-6 text-center sm:p-8"><h2 className="text-2xl font-black text-emerald-950">{block.title}</h2>{block.body && <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-sm leading-7 text-slate-600">{block.body}</p>}{block.buttonLabel && block.href && <Link href={block.href} className="btn-primary mt-5">{block.buttonLabel}</Link>}</section>;
        return null;
      })}
      {page.template === "contact" && <section className="grid gap-3 rounded-3xl border bg-white p-5 sm:grid-cols-2">
        {contacts.map(({ Icon, title, value }) => <div key={title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><Icon className="size-5 shrink-0 text-emerald-700" /><div><small className="block text-slate-500">{title}</small><b>{value}</b></div></div>)}
      </section>}
    </Wrapper>
    {!embedded && <SiteFooter />}
  </>;
}
