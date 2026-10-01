import type { Metadata } from "next";
import type { SettingsShape } from "./settings";

const isLocalHost = (url: URL) => ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname.toLowerCase());

function parseSiteUrl(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const normalized = value.trim().replace(/\/$/, "");
    const url = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch { return null; }
}

export function requestOrigin(headers: Headers) {
  const host = (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0].trim();
  const forwardedProtocol = (headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  if (!host) return undefined;
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export function siteBase(raw: string, requestUrl?: string, requirePublicOrigin = false) {
  const candidates = [raw, process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL, requestUrl];
  for (const candidate of candidates) {
    const url = parseSiteUrl(candidate);
    if (url && !isLocalHost(url)) return url;
  }
  if (process.env.NODE_ENV !== "production") return parseSiteUrl(raw) ?? new URL("http://localhost:3000");
  if (requirePublicOrigin) throw new Error("آدرس عمومی سایت تنظیم نشده است؛ siteUrl یا NEXT_PUBLIC_SITE_URL را تنظیم کنید.");
  return parseSiteUrl(raw) ?? new URL("http://localhost:3000");
}

export function seoMetadata(s: SettingsShape, input: { title: string; description: string; path: string; keywords?: string; imageId?: number | null; canonical?: string | null; type?: "website" | "article"; publishedTime?: string; modifiedTime?: string }): Metadata {
  const base = siteBase(s.siteUrl);
  const canonical = input.canonical || new URL(input.path, base).toString();
  const imageId = input.imageId || s.defaultOgImageId;
  const images = imageId ? [{ url: new URL(`/api/media/${imageId}`, base).toString(), alt: input.title }] : undefined;
  return {
    metadataBase: base,
    title: input.title,
    description: input.description,
    keywords: input.keywords?.split(/[،,]/).map((x) => x.trim()).filter(Boolean),
    alternates: { canonical },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: { type: input.type ?? "website", locale: "fa_IR", siteName: s.siteName, title: input.title, description: input.description, url: canonical, images, ...(input.type === "article" ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime } : {}) },
    twitter: { card: "summary_large_image", title: input.title, description: input.description, images: images?.map((x) => x.url) },
  };
}

export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
