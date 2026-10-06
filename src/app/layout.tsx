import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/client";
import { getSettings } from "@/lib/settings";
import { siteBase } from "@/lib/seo";
import { setCurrencyUnit } from "@/lib/util";
import { CurrencyInitializer } from "@/components/CurrencyInitializer";
import { AttributionTracker } from "@/components/AttributionTracker";
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
  return (
    <html lang="fa" dir="rtl">
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
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
      </head>
      <body className="bg-leaf-pattern min-h-screen text-slate-900 antialiased">
        <CurrencyInitializer currency={s.currency}><AttributionTracker />{children}<Toaster /></CurrencyInitializer>
      </body>
    </html>
  );
}
