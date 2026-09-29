import { desc, eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { media, sellerDocuments, sellers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { DOC_TYPES, KYC_STATUS, PROFILE_FIELDS } from "@/lib/services/kyc";
import { SellerKycForm } from "@/components/SellerKycForm";

export const metadata = { title: "پروفایل و مدارک تأمین‌کننده" };

export default async function SellerProfile() {
  const u = await requirePage({ role: "seller" });
  const [s] = await db.select().from(sellers).where(eq(sellers.id, u.sellerId!));
  const docs = await db.select({ d: sellerDocuments, mime: media.mime }).from(sellerDocuments).leftJoin(media, eq(media.id, sellerDocuments.mediaId)).where(eq(sellerDocuments.sellerId, s.id)).orderBy(desc(sellerDocuments.id));
  const tone: Record<string, string> = { verified: "from-emerald-600 to-teal-700", submitted: "from-emerald-600 to-teal-700", needs_info: "from-amber-500 to-orange-600", incomplete: "from-slate-600 to-slate-800" };
  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-l ${tone[s.kycStatus] ?? tone.incomplete} p-6 text-white`}>
        <div className="flex items-center gap-3"><ShieldCheck className="h-10 w-10" /><div><h1 className="text-2xl font-black">پروفایل و مدارک {s.shopName}</h1><p className="text-sm text-white/80">وضعیت احراز هویت: <b>{KYC_STATUS[s.kycStatus] ?? s.kycStatus}</b></p></div></div>
        <div className="text-left text-xs text-white/80">کمیسیون: <b className="text-white">{s.commissionRate.toLocaleString("fa-IR")}٪</b> · دوره تسویه: <b className="text-white">{s.settlementDays.toLocaleString("fa-IR")} روز</b></div>
      </div>
      <SellerKycForm entityType={s.entityType === "legal" ? "legal" : "individual"} profile={s.profile} iban={s.iban ?? ""} kycStatus={s.kycStatus} restricted={s.restricted} restrictReason={s.restrictReason}
        fields={PROFILE_FIELDS} docTypes={DOC_TYPES}
        docs={docs.map(({ d, mime }) => ({ id: d.id, type: d.type, title: d.title, mediaId: d.mediaId, mime, status: d.status, required: d.required, requestNote: d.requestNote, reviewNote: d.reviewNote, dueAt: d.dueAt?.toISOString() ?? null }))} />
    </div>
  );
}
