import { footerText, type FooterBlock, type FooterBrandData, type FooterConfig } from "@/lib/footer-builder";
import { SiteMenuHtml } from "./SiteMenuHtml";

function FooterContent({ item, brand, preview, previewDark }: { item: FooterBlock; brand: FooterBrandData; preview: boolean; previewDark: boolean }) {
  const text = (v: string) => footerText(v, brand);
  const linkProps = { href: item.href, target: item.newTab ? "_blank" : undefined, rel: item.newTab ? "noopener noreferrer" : undefined };
  if (item.type === "html") return preview
    ? <iframe title={item.title || "پیش‌نمایش HTML"} sandbox="" className="min-h-36 w-full border-0" style={{ background: "transparent" }} srcDoc={`<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body>${item.content}<style>html,body{margin:0!important;min-height:100%;background:${previewDark ? "#0f172a" : "#fff"}!important;color:${previewDark ? "#e2e8f0" : "#475569"}!important;font:14px/1.7 sans-serif}img{max-width:100%;height:auto}a{color:inherit}</style></body></html>`}/>
    : <SiteMenuHtml html={item.content} label={item.title}/>;
  if (item.type === "divider") return <hr className="my-2 w-full border-current opacity-15"/>;
  if (item.type === "brand") return <a href="/" className="inline-flex items-center gap-3 text-xl font-black">{brand.siteLogoMediaId > 0 && <img src={`/api/media/${brand.siteLogoMediaId}`} alt="" width={48} height={48} className="size-12 rounded-xl object-contain"/>}{brand.siteName}</a>;
  if (item.type === "contact") return <address className="space-y-3 text-sm not-italic leading-7"><p>{brand.senderAddress}</p><p><a href={`tel:${brand.supportPhone.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^+\d]/g, "")}`} dir="ltr">{brand.supportPhone}</a></p><p>{brand.supportHours}</p><a href={`mailto:${brand.supportEmail}`} dir="ltr">{brand.supportEmail}</a></address>;
  if (item.type === "image") {
    const image = item.src ? <img src={item.src} alt={item.alt || item.title} width={item.width} height={item.height} style={{ width: item.width, height: item.height, maxWidth: "100%", objectFit: "contain" }} loading="lazy"/> : <span className="block rounded-xl border border-dashed p-5 text-xs">تصویر را انتخاب کنید</span>;
    return item.href ? <a {...linkProps} className="inline-block max-w-full rounded-lg focus-visible:outline-2 focus-visible:outline-amber-400">{image}</a> : image;
  }
  if (item.type === "link") return <a {...linkProps} className="inline-block text-sm leading-7 transition hover:text-amber-600">{text(item.title)}</a>;
  return <div>{item.title && <h3 className="mb-2 font-bold">{text(item.title)}</h3>}<p className="whitespace-pre-wrap text-sm leading-8 opacity-80">{text(item.content)}</p></div>;
}
export function FooterLayout({ config, brand, preview = false, previewDark = false }: { config: FooterConfig; brand: FooterBrandData; preview?: boolean; previewDark?: boolean }) {
  const theme = config.theme === "dark" ? "bg-slate-900 text-slate-100" : config.theme === "light" ? "bg-white text-slate-800" : "bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100";
  const grids = ["", "grid-cols-1", "grid-cols-1 sm:grid-cols-2", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"];
  return <footer id="site-footer" dir="rtl" className={`footer-builder border-t border-slate-200/20 ${theme}`}>
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      {config.sections.filter(s => s.enabled).map(s => <section key={s.id} className={`py-8 ${s.border ? "border-b border-slate-400/20" : ""}`}>
        {s.title && <h2 className="mb-6 text-lg font-black">{footerText(s.title, brand)}</h2>}
        <div className={`grid gap-8 ${grids[s.columns.length] || grids[4]}`}>{s.columns.map(c => <div key={c.id} className="min-w-0" style={{ textAlign: c.align }}>
          {c.title && <h3 className="mb-4 font-bold">{footerText(c.title, brand)}</h3>}
          <div className={`flex gap-3 ${c.layout === "row" ? "flex-wrap items-center" : "flex-col"}`} style={{ ...(c.layout === "row" ? { justifyContent: c.align === "center" ? "center" : c.align === "left" ? "flex-end" : "flex-start" } : { alignItems: c.align === "center" ? "center" : c.align === "left" ? "flex-end" : "stretch" }) }}>{c.items.filter(i => i.enabled).map(i => <div key={i.id} className="min-w-0 max-w-full"><FooterContent item={i} brand={brand} preview={preview} previewDark={previewDark}/></div>)}</div>
        </div>)}</div>
      </section>)}
      {config.copyright && <p className="py-5 text-center text-xs leading-6 opacity-65">{footerText(config.copyright, brand)}</p>}
    </div>
  </footer>;
}
