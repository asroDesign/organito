import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { requestOrigin, siteBase } from "@/lib/seo";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  const base = siteBase(s.siteUrl, requestOrigin(await headers()), true);
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/seller/", "/customer/", "/api/", "/login"] }, sitemap: new URL("/sitemap.xml", base).toString(), host: base.origin };
}
