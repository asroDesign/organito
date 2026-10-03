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
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
      </head>
      <body className="bg-leaf-pattern min-h-screen text-slate-900 antialiased">
        <CurrencyInitializer currency={s.currency}><AttributionTracker />{children}<Toaster /></CurrencyInitializer>
      </body>
    </html>
  );
}
