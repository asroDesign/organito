import Link from "next/link";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { SiteBrand } from "./SiteBrand";
import { db } from "@/db";
import { footerLinks } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { FooterScripts } from "./FooterScripts";
import { getSiteMenu } from "@/lib/site-menus";
import type { SiteMenuItem } from "@/lib/site-menus";

function FooterItem({ item, nested = false }: { item: SiteMenuItem; nested?: boolean }) {
  const linkClass = nested ? "text-xs text-slate-400 hover:text-white" : "text-sm text-slate-300 hover:text-white";
  const content = item.href ? (/^https:\/\//i.test(item.href)
    ? <a href={item.href} target={item.targetBlank ? "_blank" : undefined} rel={item.targetBlank ? "noopener noreferrer" : undefined} className={linkClass}>{item.label}</a>
    : <Link href={item.href} target={item.targetBlank ? "_blank" : undefined} rel={item.targetBlank ? "noopener noreferrer" : undefined} className={linkClass}>{item.label}</Link>) : <span className="font-medium text-slate-200">{item.label}</span>;
  return <li>{content}{item.children.length > 0 && <ul className="mt-1 space-y-1 border-r border-slate-700 pr-3">{item.children.map((child) => <FooterItem key={child.id} item={child} nested/>)}</ul>}</li>;
}

export async function SiteFooter() {
  const s = await getSettings();
  let menuItems: SiteMenuItem[] = [];
  let legacyFallback = false;
  try { const menu = await getSiteMenu("footer"); menuItems = menu?.items ?? []; if (menu?.enabled === false) legacyFallback = false; }
  catch { legacyFallback = true; /* During a rolling migration, keep serving the legacy footer links. */ }
  const legacy = legacyFallback ? await db.select().from(footerLinks).where(eq(footerLinks.enabled, true)).orderBy(asc(footerLinks.sortOrder), asc(footerLinks.id)).catch(() => []) : [];
  const links: SiteMenuItem[] = menuItems.length ? menuItems : legacy.map((item) => ({ ...item, menuId: 0, parentId: null, groupTitle: item.groupTitle, targetBlank: false, legacyFooterLinkId: null, deletedAt: null, children: [] }));
  const groups = Array.from(new Set(links.map((item) => item.groupTitle || "دسترسی سریع")));
  return (
    <footer className="mt-12 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><div className="flex items-center gap-2 text-white"><SiteBrand name={s.siteName} logoMediaId={Number(s.siteLogoMediaId)} boxClassName="h-8 w-8" iconClassName="h-4 w-4"/><b className="text-lg">{s.siteName}</b></div><p className="text-sm leading-7">{s.siteTagline}. خرید مطمئن محصولات ارگانیک، طبیعی و محلی مستقیم از کشاورزان و تولیدکنندگان.</p></div>
        {groups.map((group) => <div key={group}><b className="mb-3 block text-white">{group}</b><ul className="space-y-2">{links.filter((item) => (item.groupTitle || "دسترسی سریع") === group && !item.parentId).map((item) => <FooterItem key={item.id} item={item}/>)}</ul></div>)}
        <div className="space-y-2 text-sm"><b className="mb-3 block text-white">ارتباط با ما</b><div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{s.senderAddress}</div><div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span dir="ltr">{s.supportPhone}</span></div><div className="flex items-center gap-2"><Clock className="h-4 w-4" />{s.supportHours}</div><div className="flex items-center gap-2"><Mail className="h-4 w-4" />{s.supportEmail}</div></div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs">© {s.siteName} — تمامی حقوق محفوظ است.</div>
      <FooterScripts code={s.footerScripts} />
    </footer>
  );
}
