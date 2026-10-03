"use client";

import { useEffect } from "react";

type Attribution = {
  source: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
};

export function AttributionTracker() {
  useEffect(() => {
    if (document.cookie.split("; ").some((cookie) => cookie.startsWith("sbz_attribution="))) return;
    try {
      const params = new URLSearchParams(location.search);
      const utmSource = params.get("utm_source")?.slice(0, 100) || undefined;
      const referrer = document.referrer ? new URL(document.referrer) : null;
      const referrerHost = referrer && referrer.host !== location.host ? referrer.hostname.slice(0, 190) : undefined;
      const normalizedHost = referrerHost?.replace(/^www\./, "").toLowerCase();
      const source = utmSource || (normalizedHost?.includes("google.") ? "Google" : normalizedHost?.includes("bing.") ? "Bing" : referrerHost || "ورود مستقیم");
      const attribution: Attribution = {
        source,
        referrerHost,
        utmSource,
        utmMedium: params.get("utm_medium")?.slice(0, 100) || undefined,
        utmCampaign: params.get("utm_campaign")?.slice(0, 150) || undefined,
        landingPath: location.pathname.slice(0, 700),
      };
      const value = encodeURIComponent(JSON.stringify(attribution));
      document.cookie = `sbz_attribution=${value}; Max-Age=7776000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      // Attribution is optional and must never interfere with browsing or checkout.
    }
  }, []);

  return null;
}
