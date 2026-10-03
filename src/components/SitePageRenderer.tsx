import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { SitePageBlock } from "@/db/schema";
import type { SettingsShape } from "@/lib/settings";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { siteBrandText } from "@/lib/brand";
import { SiteBlockContent } from "./SiteBlockContent";
import { PageBlockFrame } from "./PageBlockFrame";

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
      {brandedPage.blocks.map((block, index) => <PageBlockFrame key={block.id || index} block={block}><SiteBlockContent block={block} /></PageBlockFrame>)}
      {page.template === "contact" && <section className="grid gap-3 rounded-3xl border bg-white p-5 sm:grid-cols-2">
        {contacts.map(({ Icon, title, value }) => <div key={title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><Icon className="size-5 shrink-0 text-emerald-700" /><div><small className="block text-slate-500">{title}</small><b>{value}</b></div></div>)}
      </section>}
    </Wrapper>
    {!embedded && <SiteFooter />}
  </>;
}
