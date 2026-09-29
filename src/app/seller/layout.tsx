import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellers } from "@/db/schema";
import { requirePage } from "@/lib/auth";

export default async function SellerLayout({ children }: { children: ReactNode }) {
  const u = await requirePage({ role: "seller" });
  const [s] = await db.select({ restricted: sellers.restricted, reason: sellers.restrictReason, kyc: sellers.kycStatus }).from(sellers).where(eq(sellers.id, u.sellerId!));
  return (
    <Shell user={u} area="seller">
      {u.sellerStatus !== "approved" && <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">حساب تأمین‌کننده شما در وضعیت «{u.sellerStatus}» است. تا تأیید مدیر مارکت‌پلیس امکان فروش و ثبت محصول وجود ندارد.</div>}
      {s?.restricted && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>⛔ دسترسی‌های فروش شما به دلیل «{s.reason ?? "مدارک ناقص"}» محدود شده است.</span><Link href="/seller/profile" className="btn-sm !border-rose-300 !text-rose-700">تکمیل مدارک</Link></div>}
      {!s?.restricted && s && ["incomplete", "needs_info"].includes(s.kyc) && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><span>{s.kyc === "needs_info" ? "مدیریت مدارک تکمیلی از شما درخواست کرده است." : "اطلاعات هویتی و مدارک خود را تکمیل کنید."}</span><Link href="/seller/profile" className="btn-sm">پروفایل و مدارک</Link></div>}
      {children}
    </Shell>
  );
}
