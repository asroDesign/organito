import type { Metadata } from "next";
import type { SettingsShape } from "./settings";

export function siteBase(raw: string) {
  const value = raw.trim().replace(/\/$/, "");
  try { return new URL(value.startsWith("http") ? value : `https://${value}`); } catch { return new URL("http://localhost:3000"); }
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
