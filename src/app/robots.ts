import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { requestOrigin, siteBase } from "@/lib/seo";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  const base = siteBase(s.siteUrl, requestOrigin(await headers()), true);
  const lines = (value: unknown) => String(value ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const agents = lines(s.robotsUserAgents).filter((x) => x === "*" || /^[A-Za-z0-9._-]{1,80}$/.test(x));
  const paths = (value: unknown) => lines(value).filter((x) => x.startsWith("/") && !x.startsWith("//") && !/[?#\s\u0000-\u001f]/.test(x));
  const allow = paths(s.robotsAllowPaths);
  const disallow = paths(s.robotsDisallowPaths);
  const rules: NonNullable<MetadataRoute.Robots["rules"]> = {
    userAgent: agents.length ? agents : "*",
    ...(allow.length ? { allow } : {}),
    ...(disallow.length ? { disallow } : {}),
  };
  return {
    rules,
    ...(Number(s.robotsSitemapEnabled) !== 0 ? { sitemap: new URL("/sitemap.xml", base).toString() } : {}),
    host: base.origin,
  };
}
