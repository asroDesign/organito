import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSettings } from "./settings";
import { getSiteMenu, type SiteMenuItem } from "./site-menus";
import { HttpError } from "./util";
import { sanitizeFooterHtml } from "./footer-html";
import { footerTypeLabels, footerUrlAllowed, type FooterConfig, type FooterBlock, type FooterBrandData } from "./footer-builder";
export const FOOTER_KEY = "siteFooterBuilderV1";
export function validateFooter(raw: unknown): FooterConfig {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "ساختار فوتر معتبر نیست");
  const c = raw as FooterConfig;
  if (c.version !== 1 || !Array.isArray(c.sections) || c.sections.length > 16 || !["light", "dark", "system"].includes(c.theme) || typeof c.enabled !== "boolean") throw new HttpError(400, "تنظیمات فوتر معتبر نیست؛ حداکثر ۱۶ بخش مجاز است");
  const ids = new Set<string>();
  const id = (v: unknown) => { if (typeof v !== "string" || !/^[\w-]{1,80}$/.test(v) || ids.has(v)) throw new HttpError(400, "شناسهٔ تکراری یا نامعتبر در فوتر"); ids.add(v); return v; };
  const text = (v: unknown, max = 2000) => { if (typeof v !== "string" || v.length > max) throw new HttpError(400, "طول یا نوع محتوای فوتر معتبر نیست"); return v; };
  const url = (v: unknown, image = false) => { const s = text(v, 2000).trim(); if (!footerUrlAllowed(s, image)) throw new HttpError(400, "نشانی باید داخلی یا HTTPS باشد؛ برای پیوند تلفن و ایمیل نیز مجاز است"); return s; };
  const size = (v: unknown) => { if (!Number.isInteger(v) || Number(v) < 16 || Number(v) > 1200) throw new HttpError(400, "ابعاد تصویر باید بین ۱۶ تا ۱۲۰۰ پیکسل باشد"); return Number(v); };
  return { version: 1, enabled: c.enabled, theme: c.theme, copyright: text(c.copyright), sections: c.sections.map(s => {
    if (!s || !Array.isArray(s.columns) || !s.columns.length || s.columns.length > 4) throw new HttpError(400, "هر بخش باید یک تا چهار ستون داشته باشد");
    return { id: id(s.id), title: text(s.title, 150), enabled: s.enabled !== false, border: s.border === true, columns: s.columns.map(col => {
      if (!col || !Array.isArray(col.items) || col.items.length > 30 || !["right", "center", "left"].includes(col.align) || !["stack", "row"].includes(col.layout)) throw new HttpError(400, "تنظیمات ستون معتبر نیست؛ حداکثر ۳۰ آیتم مجاز است");
      return { id: id(col.id), title: text(col.title, 150), align: col.align, layout: col.layout, items: col.items.map(i => {
        if (!i || !Object.hasOwn(footerTypeLabels, i.type)) throw new HttpError(400, "نوع آیتم معتبر نیست");
        const content = text(i.content, 20000);
        const result: FooterBlock = { id: id(i.id), type: i.type, enabled: i.enabled !== false, title: text(i.title, 150), content: i.type === "html" ? sanitizeFooterHtml(content) : content, href: url(i.href), src: url(i.src, true), alt: text(i.alt, 300), width: size(i.width), height: size(i.height), newTab: i.newTab === true };
        if (result.enabled && result.type === "image" && !result.src) throw new HttpError(400, "برای تصویر نشانی یا فایل انتخاب کنید");
        if (result.enabled && result.type === "link" && (!result.href || !result.title)) throw new HttpError(400, "عنوان و نشانی پیوند را وارد کنید");
        return result;
      }) };
    }) };
  }) };
}
export async function getFooterBuilderState() {
  const [s, rows, menu] = await Promise.all([getSettings(), db.select().from(settings).where(eq(settings.key, FOOTER_KEY)), getSiteMenu("footer")]);
  const brand: FooterBrandData = { siteName: s.siteName, siteTagline: s.siteTagline, siteLogoMediaId: Number(s.siteLogoMediaId), supportPhone: s.supportPhone, supportEmail: s.supportEmail, supportHours: s.supportHours, senderAddress: s.senderAddress };
  const saved = rows[0]?.value as { revision: number; config: FooterConfig } | undefined;
  if (saved) return { config: saved.config, revision: saved.revision, brand };
  let serial = 0;
  const block = (type: FooterBlock["type"], values: Partial<FooterBlock> = {}): FooterBlock => ({ id: `initial-item-${++serial}`, type, enabled: true, title: "", content: "", href: "", src: "", alt: "", width: 120, height: 120, newTab: false, ...values });
  const flatten = (items: SiteMenuItem[]): FooterBlock[] => items.flatMap(i => [block(i.customHtml ? "html" : i.href ? "link" : "text", { title: i.customHtml ? "کد HTML" : i.label, content: i.customHtml || (i.href ? "" : i.label), href: i.href || "", newTab: i.targetBlank }), ...flatten(i.children)]);
  const groups = [...new Set((menu?.items || []).map(i => i.groupTitle || "دسترسی سریع"))];
  const columns = [
    { id: "initial-brand", title: "", align: "right" as const, layout: "stack" as const, items: [block("brand"), block("text", { content: "{{siteTagline}}" })] },
    ...groups.map((title, index) => ({ id: `initial-links-${index}`, title, align: "right" as const, layout: "stack" as const, items: flatten((menu?.items || []).filter(i => (i.groupTitle || "دسترسی سریع") === title)) })),
    { id: "initial-contact", title: "ارتباط با ما", align: "right" as const, layout: "stack" as const, items: [block("contact")] },
  ];
  const sections = [];
  for (let i = 0; i < columns.length; i += 4) sections.push({ id: `initial-section-${i}`, title: "", enabled: true, border: true, columns: columns.slice(i, i + 4) });
  return { config: { version: 1, enabled: true, theme: "system", copyright: "© {{siteName}} — تمامی حقوق محفوظ است.", sections } as FooterConfig, revision: 0, brand };
}
