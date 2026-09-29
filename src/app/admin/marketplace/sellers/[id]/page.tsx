import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { FileText, ShieldCheck, Building2, User } from "lucide-react";
import { db } from "@/db";
import { media, sellerDocuments, sellers, users, wallets } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { DOC_STATUS, DOC_TYPES, KYC_STATUS, PROFILE_FIELDS } from "@/lib/services/kyc";
import { Badge, Card, KV, PageHeader } from "@/components/ui";
import { SellerTermsEditor } from "@/components/SellerTermsEditor";
import { DocReviewButtons, RequestDocForm, RestrictToggle } from "@/components/SellerDocAdmin";
import { jdate, toman, maskIban } from "@/lib/util";

export default async function SellerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "SELLER_SETTLEMENT_MANAGE" });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db.select({ s: sellers, u: users, w: wallets }).from(sellers).innerJoin(users, eq(users.id, sellers.userId)).leftJoin(wallets, eq(wallets.sellerId, sellers.id)).where(eq(sellers.id, id));
  if (!row) notFound();
  const { s, u, w } = row;
  const docs = await db.select({ d: sellerDocuments, mime: media.mime, size: media.size }).from(sellerDocuments).leftJoin(media, eq(media.id, sellerDocuments.mediaId)).where(eq(sellerDocuments.sellerId, id)).orderBy(desc(sellerDocuments.id));
  const revIds = docs.map((x) => x.d.reviewedBy).filter(Boolean) as number[];
  const revs = revIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, revIds)) : [];
  const et = s.entityType === "legal" ? "legal" : "individual";
  const tone: Record<string, string> = { approved: "green", pending: "blue", requested: "yellow", rejected: "red" };
  const kycTone: Record<string, string> = { verified: "green", submitted: "blue", needs_info: "yellow", incomplete: "gray" };
  return (
    <>
      <PageHeader title={s.shopName} subtitle={`${u.name} · ${u.phone} · عضویت ${jdate(s.createdAt)}`} actions={<>
        <Badge tone={kycTone[s.kycStatus]}><ShieldCheck className="h-3 w-3" />{KYC_STATUS[s.kycStatus]}</Badge>
        {s.restricted && <Badge tone="red">محدودشده: {s.restrictReason}</Badge>}
        <RestrictToggle sellerId={s.id} restricted={s.restricted} />
        <Link href="/admin/marketplace" className="btn-ghost">بازگشت</Link>
      </>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2">{et === "legal" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}اطلاعات {et === "legal" ? "حقوقی" : "حقیقی"}</span>}>
            <div className="grid gap-x-8 sm:grid-cols-2">
              {PROFILE_FIELDS[et].map(([k, l]) => <KV key={k} k={l} v={s.profile[k] || <span className="text-slate-300">—</span>} />)}
              <KV k="شبا" v={<span dir="ltr">{maskIban(s.iban)}</span>} /><KV k="شهر" v={s.city} />
            </div>
          </Card>
          <Card title={`مدارک بارگذاری‌شده (${docs.length.toLocaleString("fa-IR")})`}>
            {docs.length === 0 ? <p className="text-sm text-slate-500">مدرکی بارگذاری نشده است.</p> : (
              <div className="grid gap-3 md:grid-cols-2">
                {docs.map(({ d, mime, size }) => (
                  <div key={d.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                    {d.mediaId ? (mime === "application/pdf"
                      ? <a href={`/api/media/${d.mediaId}`} target="_blank" className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><FileText className="h-10 w-10" /></a>
                      : <a href={`/api/media/${d.mediaId}`} target="_blank" className="shrink-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${d.mediaId}`} alt={d.title} className="h-24 w-24 rounded-lg border object-cover transition hover:scale-105" /></a>)
                      : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg border border-dashed text-xs text-slate-400">بدون فایل</div>}
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <b className="block text-sm">{d.title}{d.required && <span className="text-rose-500"> *</span>}</b>
                      <Badge tone={tone[d.status]}>{DOC_STATUS[d.status]}</Badge>
                      {d.uploadedAt && <div className="text-slate-400">بارگذاری: {jdate(d.uploadedAt, true)}{size ? ` · ${Math.round(size / 1024).toLocaleString("fa-IR")}KB` : ""}</div>}
                      {d.requestNote && <div className="text-amber-700">درخواست: {d.requestNote}</div>}
                      {d.reviewNote && <div className="text-rose-600">یادداشت بررسی: {d.reviewNote}</div>}
                      {d.reviewedBy && <div className="text-slate-400">بررسی: {revs.find((r) => r.id === d.reviewedBy)?.name} · {jdate(d.reviewedAt)}</div>}
                      {["pending", "rejected", "requested"].includes(d.status) && <div className="pt-1"><DocReviewButtons docId={d.id} hasFile={!!d.mediaId} /></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="شرایط همکاری"><SellerTermsEditor id={s.id} status={s.status} contract={s.contractStatus} rate={s.commissionRate} days={s.settlementDays} /></Card>
          <Card title="درخواست مدرک یا اطلاعات تکمیلی"><RequestDocForm sellerId={s.id} docTypes={Object.entries(DOC_TYPES).map(([k, d]) => [k, d.title])} /></Card>
          <Card title="کیف پول"><KV k="در انتظار آزادسازی" v={toman(w?.pendingBalance)} /><KV k="قابل برداشت" v={toman(w?.availableBalance)} /><KV k="قفل‌شده" v={toman(w?.lockedBalance)} /><KV k="برداشت‌شده" v={toman(w?.withdrawnBalance)} /></Card>
        </div>
      </div>
    </>
  );
}
