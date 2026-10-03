import type { HomeBuilderDocument, SitePageBlock, SitePageBlockItem } from "@/db/schema";
import { HOME_SECTION_LABELS } from "./home-page-builder";
import { HttpError } from "./util";

export const BLOCK_LABELS: Record<SitePageBlock["type"], string> = { hero: "بنر بزرگ", text: "متن", image: "تصویر", cta: "دعوت به اقدام", grid: "گرید محتوایی", slider: "اسلایدر", features: "کارت‌های ویژگی", faq: "پرسش‌های متداول", store_section: "بخش فروشگاه" };
export const builderId = () => `b-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()}`;
export const blockLabel = (block: SitePageBlock) => block.name || block.title || HOME_SECTION_LABELS[block.sectionId ?? ""] || BLOCK_LABELS[block.type];
export const identifyBlocks = (blocks: SitePageBlock[]): SitePageBlock[] => blocks.map((b, i) => ({ ...b, id: b.id || `section-${i}-${b.sectionId || b.type}`, items: b.items?.map((it, j) => ({ ...it, id: it.id || `item-${i}-${j}` })) }));
export const createBlock = (type: SitePageBlock["type"], sectionId?: string): SitePageBlock => ({ id: builderId(), type, sectionId, title: type === "store_section" ? "" : BLOCK_LABELS[type], body: "", items: ["grid", "slider", "features", "faq"].includes(type) ? [{ id: builderId(), kind: "image", title: "عنوان محتوا", body: "متن دلخواه را وارد کنید.", buttonLabel: "مشاهده محصولات", href: "/shop" }] : [], enabled: true });

const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 500) => typeof v === "string" ? v.slice(0, max) : "";
const number = (v: unknown, min: number, max: number): number | undefined => v === undefined || v === null || v === "" ? undefined : Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : undefined;
const color = (v: unknown) => /^#[\da-f]{6}$/i.test(String(v)) ? String(v) : undefined;
export function safeBuilderHref(v: unknown): string {
  const href = text(v).trim();
  if (!href) return "";
  if (/[\\\u0000-\u0020]/.test(href) || (!(href.startsWith("/") && !href.startsWith("//")) && !/^https:\/\//i.test(href) && !/^#[a-zA-Z][\w-]*$/.test(href))) throw new HttpError(400, "پیوند باید داخلی، لنگر معتبر یا HTTPS باشد");
  return href;
}
export function normalizeBlocks(input: unknown): SitePageBlock[] {
  if (!Array.isArray(input) || input.length > 60) throw new HttpError(400, "حداکثر ۶۰ بخش برای صفحه مجاز است");
  const seen = new Set<string>();
  const anchors = new Set<string>();
  return input.map((raw) => {
    const x = object(raw), style = object(x.style), options = object(x.options);
    const type = text(x.type) as SitePageBlock["type"];
    if (!Object.hasOwn(BLOCK_LABELS, type)) throw new HttpError(400, "نوع بخش صفحه نامعتبر است");
    const sectionId = text(x.sectionId, 40);
    if (type === "store_section" && !Object.hasOwn(HOME_SECTION_LABELS, sectionId)) throw new HttpError(400, "بخش فروشگاه نامعتبر است");
    const id = /^[\w-]{1,80}$/.test(String(x.id)) && !seen.has(String(x.id)) ? String(x.id) : builderId(); seen.add(id);
    if (Array.isArray(x.items) && x.items.length > 30) throw new HttpError(400, "هر بخش حداکثر ۳۰ آیتم دارد");
    const anchor = /^[a-zA-Z][\w-]{0,79}$/.test(String(x.anchor)) ? String(x.anchor) : "";
    if (anchor && anchors.has(anchor)) throw new HttpError(400, "شناسه لنگر بخش‌ها نباید تکراری باشد");
    if (anchor) anchors.add(anchor);
    const itemIds = new Set<string>();
    const items: SitePageBlockItem[] = (Array.isArray(x.items) ? x.items : []).map((rawItem) => {
      const it = object(rawItem);
      const itemId = text(it.id, 80) && !itemIds.has(String(it.id)) ? text(it.id, 80) : builderId(); itemIds.add(itemId);
      return { id: itemId, kind: ["text", "image", "cta"].includes(String(it.kind)) ? it.kind as SitePageBlockItem["kind"] : "text", title: text(it.title, 180), body: text(it.body, 5000), mediaId: number(it.mediaId, 1, 2147483647) ?? null, caption: text(it.caption, 300), buttonLabel: text(it.buttonLabel, 80), href: safeBuilderHref(it.href), colSpan: number(it.colSpan, 1, 4) };
    });
    return { id, type, sectionId, name: text(x.name, 100), enabled: x.enabled !== false, anchor, title: text(x.title, 180), body: text(x.body, 10000), mediaId: number(x.mediaId, 1, 2147483647) ?? null, caption: text(x.caption, 300), buttonLabel: text(x.buttonLabel, 80), href: safeBuilderHref(x.href), items,
      style: { background: color(style.background), color: color(style.color), accent: color(style.accent), align: ["left", "right", "center"].includes(String(style.align)) ? style.align as "left" | "right" | "center" : undefined, width: ["full", "contained"].includes(String(style.width)) ? style.width as "full" | "contained" : undefined, padding: number(style.padding, 0, 160), paddingMobile: number(style.paddingMobile, 0, 80), marginBottom: number(style.marginBottom, 0, 160), radius: number(style.radius, 0, 100), minHeight: number(style.minHeight, 0, 1200), gap: number(style.gap, 0, 80), columns: number(style.columns, 1, 6), mobileColumns: number(style.mobileColumns, 1, 2), hideDesktop: style.hideDesktop === true, hideMobile: style.hideMobile === true },
      options: { badge: text(options.badge, 120), secondaryLabel: text(options.secondaryLabel, 80), secondaryHref: safeBuilderHref(options.secondaryHref), showSearch: options.showSearch !== false, showStats: options.showStats !== false, autoplay: options.autoplay === true, interval: number(options.interval, 3, 30), limit: number(options.limit, 1, 24), categoryId: number(options.categoryId, 1, 2147483647), productIds: Array.isArray(options.productIds) ? [...new Set(options.productIds.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 2147483647))].slice(0, 24) : [] },
    };
  });
}
export function normalizeDocument(value: unknown): HomeBuilderDocument {
  const doc = object(value);
  if (JSON.stringify(doc).length > 1500000) throw new HttpError(400, "حجم محتوای صفحه بیش از حد مجاز است");
  return { title: text(doc.title, 180) || "صفحه اصلی", metaTitle: text(doc.metaTitle, 180), metaDescription: text(doc.metaDescription, 320), blocks: normalizeBlocks(doc.blocks) };
}
