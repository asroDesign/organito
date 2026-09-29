import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/client";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "سبزینه | مارکت‌پلیس محصولات ارگانیک و طبیعی", template: "%s | سبزینه" },
  description: "خرید آنلاین محصولات ارگانیک، طبیعی و محلی مستقیم از کشاورزان و تولیدکنندگان معتبر",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#047857" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
      </head>
      <body className="bg-leaf-pattern min-h-screen text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
