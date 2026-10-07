import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/client";
import { getSettings } from "@/lib/settings";
import { siteBase } from "@/lib/seo";
import { setCurrencyUnit } from "@/lib/util";
import { CurrencyInitializer } from "@/components/CurrencyInitializer";
import { AttributionTracker } from "@/components/AttributionTracker";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { ProductCompareDock } from "@/components/ProductCompareDock";
import "./globals.css";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { metadataBase: siteBase(s.siteUrl), title: { default: s.homeSeoTitle, template: `%s | ${s.siteName}` }, description: s.homeSeoDescription, applicationName: s.siteName, category: "shopping" };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#047857" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSettings();
  setCurrencyUnit(s.currency);
  const defaultTheme = ["light", "dark", "system"].includes(s.appearanceMode) ? s.appearanceMode : "light";
  const palette = ["sunshine", "forest", "ocean"].includes(s.appearancePalette) ? s.appearancePalette : "sunshine";
  return (
    <html lang="fa" dir="rtl" data-default-theme={defaultTheme} data-theme="light" data-palette={palette} suppressHydrationWarning>
      <head>
        {/* Yektanet analytics — keep it first inside the head so it runs before everything else. */}
        <script
          id="yektanet-analytics"
          dangerouslySetInnerHTML={{
            __html: `
              !function (t, e, n) {
                  t.yektanetAnalyticsObject = n, t[n] = t[n] || function () {
                      t[n].q.push(arguments)
                  }, t[n].q = t[n].q || [];
                  var a = new Date, r = a.getFullYear().toString() + "0" + a.getMonth() + "0" + a.getDate() + "0" + a.getHours(),
                      c = e.getElementsByTagName("script")[0], s = e.createElement("script");
                  s.id = "ua-script-F3qfXuTu"; s.dataset.analyticsobject = n;
                  s.async = 1; s.type = "text/javascript";
                  s.src = "https://cdn.yektanet.com/rg_woebegone/scripts_v3/F3qfXuTu/rg.complete.js?v=" + r, c.parentNode.insertBefore(s, c)
              }(window, document, "yektanet");
            `,
          }}
        />
        <script id="appearance-init" dangerouslySetInnerHTML={{ __html: `try{var r=document.documentElement;var p=localStorage.getItem("organo-color-mode");var d=r.dataset.defaultTheme;var m=(p==="light"||p==="dark")?p:(d==="light"||d==="dark")?d:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");r.dataset.theme=m;}catch(e){document.documentElement.dataset.theme=document.documentElement.dataset.defaultTheme==="dark"?"dark":"light";}` }} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
      </head>
      <body className="bg-leaf-pattern min-h-screen text-slate-900 antialiased">
        <CurrencyInitializer currency={s.currency}><AttributionTracker /><AnalyticsTracker />{children}<ProductCompareDock /><Toaster /></CurrencyInitializer>
      </body>
    </html>
  );
}
