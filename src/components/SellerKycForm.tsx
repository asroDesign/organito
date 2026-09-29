"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, Upload, Loader2, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Send } from "lucide-react";
import { api, toast } from "./client";

type Doc = { id: number; type: string; title: string; mediaId: number | null; mime: string | null; status: string; required: boolean; requestNote: string | null; reviewNote: string | null; dueAt: string | null };
type Props = {
  entityType: "individual" | "legal"; profile: Record<string, string>; iban: string; kycStatus: string; restricted: boolean; restrictReason: string | null;
  fields: Record<"individual" | "legal", [string, string, boolean][]>; docTypes: Record<string, { title: string; for: string[]; required: string[] }>; docs: Doc[];
};
const ST: Record<string, [string, string, typeof Clock]> = {
  requested: ["درخواست‌شده", "bg-amber-100 text-amber-800", AlertTriangle], pending: ["در انتظار بررسی", "bg-emerald-100 text-emerald-800", Clock],
  approved: ["تأییدشده", "bg-emerald-100 text-emerald-800", CheckCircle2], rejected: ["ردشده", "bg-rose-100 text-rose-800", XCircle],
};

async function uploadFile(file: File): Promise<number> {
  const fd = new FormData();
  fd.append("file", file); fd.append("kind", "document");
  const r = await fetch("/api/media", { method: "POST", body: fd, headers: { "x-csrf": "1" } });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "خطای بارگذاری");
  return j.id;
}

function DocThumb({ id, mime }: { id: number; mime: string | null }) {
  return mime === "application/pdf"
    ? <a href={`/api/media/${id}`} target="_blank" className="grid h-16 w-16 place-items-center rounded-lg border bg-rose-50 text-rose-600"><FileText className="h-7 w-7" /><span className="-mt-3 text-[9px] font-bold">PDF</span></a>
    : <a href={`/api/media/${id}`} target="_blank">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${id}`} alt="" className="h-16 w-16 rounded-lg border object-cover" /></a>;
}

export function SellerKycForm(p: Props) {
  const router = useRouter();
  const [et, setEt] = useState<"individual" | "legal">(p.entityType);
  const [f, setF] = useState<Record<string, string>>(p.profile);
  const [iban, setIban] = useState(p.iban);
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (submit: boolean) => {
    setBusy(submit ? "submit" : "save");
    try { await api("/api/seller/profile", "POST", { ...f, entityType: et, iban, submit }); toast(submit ? "اطلاعات و مدارک برای بررسی ارسال شد" : "اطلاعات ذخیره شد"); router.refresh(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(null); }
  };
  const upload = async (file: File | undefined, slot: { docId?: number; type?: string; title?: string }) => {
    if (!file) return;
    const key = slot.docId ? `d${slot.docId}` : `t${slot.type}`;
    setBusy(key);
    try { const mediaId = await uploadFile(file); await api("/api/seller/documents", "POST", { ...slot, mediaId }); toast("مدرک بارگذاری شد"); router.refresh(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(null); }
  };
  const requested = p.docs.filter((d) => d.status === "requested" || (d.status === "rejected"));
  const typeList = Object.entries(p.docTypes).filter(([k, d]) => d.for.includes(et) && k !== "other");
  return (
    <div className="space-y-6">
      {p.restricted && <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-5 w-5 shrink-0" /><div><b>دسترسی‌های فروش شما محدود شده است.</b><div>دلیل: {p.restrictReason ?? "مدارک ناقص"}. تا بارگذاری مدارک درخواستی، امکان ثبت محصول و پیشنهاد، فعال‌سازی پیشنهاد، پاسخ به RFQ و درخواست برداشت وجود ندارد و پیشنهادهای شما در فروشگاه نمایش داده نمی‌شوند. سفارش‌های قبلی را همچنان می‌توانید ارسال کنید.</div></div></div>}
      {requested.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <b className="flex items-center gap-2 text-amber-900"><AlertTriangle className="h-5 w-5" />مدارک درخواستی مدیریت ({requested.length.toLocaleString("fa-IR")})</b>
          <div className="mt-3 space-y-2">
            {requested.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
                <div><b>{d.title}</b>{d.requestNote && <div className="text-xs text-slate-600">توضیح مدیر: {d.requestNote}</div>}{d.reviewNote && <div className="text-xs text-rose-600">دلیل رد: {d.reviewNote}</div>}{d.dueAt && <div className="text-xs text-slate-400">مهلت: {new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(new Date(d.dueAt))}</div>}</div>
                <label className="btn-primary cursor-pointer">{busy === `d${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}بارگذاری<input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => upload(e.target.files?.[0], { docId: d.id })} /></label>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <b className="mb-3 block">نوع شخصیت</b>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["individual", "شخص حقیقی", "فروشگاه یا کسب‌وکار انفرادی با جواز کسب", User], ["legal", "شخص حقوقی", "شرکت ثبت‌شده با روزنامه رسمی", Building2]] as const).map(([k, l, d, I]) => (
            <button key={k} type="button" onClick={() => setEt(k)} className={`flex items-center gap-3 rounded-xl border-2 p-4 text-right transition ${et === k ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${et === k ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}><I className="h-5 w-5" /></span><span><b className="block">{l}</b><span className="text-xs text-slate-500">{d}</span></span>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <b className="mb-3 block">{et === "legal" ? "اطلاعات شرکت" : "اطلاعات هویتی و کسب‌وکار"}</b>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {p.fields[et].map(([k, l, req]) => (
            <label key={k} className={`text-sm ${k === "address" || k === "signatories" ? "sm:col-span-2 lg:col-span-3" : ""}`}>{l}{req && <span className="text-rose-500"> *</span>}
              {k === "address" || k === "signatories" ? <textarea value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input mt-1 min-h-16" /> : <input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} dir={/Code|Number|Id|mobile|phone|postal/i.test(k) ? "ltr" : undefined} className="input mt-1" />}
            </label>
          ))}
          <label className="text-sm sm:col-span-2">شماره شبا حساب تسویه<input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IR..." dir="ltr" className="input mt-1" /></label>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <b className="mb-1 block">مدارک هویتی و مجوزها</b>
        <p className="mb-4 text-xs text-slate-500">فرمت‌های مجاز: JPG، PNG، WebP و PDF تا ۸ مگابایت. موارد ستاره‌دار الزامی است.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {typeList.map(([k, d]) => {
            const mine = p.docs.filter((x) => x.type === k).sort((a, b) => b.id - a.id);
            const latest = mine[0];
            const st = latest ? ST[latest.status] : null;
            const Icon = st?.[2];
            return (
              <div key={k} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                {latest?.mediaId ? <DocThumb id={latest.mediaId} mime={latest.mime} /> : <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed text-slate-300"><FileText className="h-7 w-7" /></div>}
                <div className="min-w-0 flex-1 text-sm">
                  <b className="block">{d.title}{d.required.includes(et) && <span className="text-rose-500"> *</span>}</b>
                  {st && Icon ? <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${st[1]}`}><Icon className="h-3 w-3" />{st[0]}</span> : <span className="text-xs text-slate-400">بارگذاری نشده</span>}
                  {latest?.reviewNote && latest.status === "rejected" && <div className="text-[11px] text-rose-600">{latest.reviewNote}</div>}
                </div>
                {latest?.status !== "approved" && <label className="btn-sm cursor-pointer">{busy === `t${k}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}{latest?.mediaId ? "جایگزینی" : "بارگذاری"}<input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => upload(e.target.files?.[0], latest && latest.status !== "approved" ? { docId: latest.id } : { type: k })} /></label>}
              </div>
            );
          })}
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
            <FileText className="h-6 w-6 text-slate-400" /><span className="flex-1">سایر مدارک (گواهی، نمایندگی و…)</span>
            <label className="btn-sm cursor-pointer">{busy === "tother" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}افزودن<input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const t = window.prompt("عنوان مدرک:", "مدرک تکمیلی"); if (t) upload(e.target.files?.[0], { type: "other", title: t }); e.target.value = ""; }} /></label>
          </div>
        </div>
        {p.docs.filter((d) => d.type === "other" && d.mediaId).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{p.docs.filter((d) => d.type === "other" && d.mediaId).map((d) => <span key={d.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs">{d.title} <span className={`rounded px-1.5 ${ST[d.status][1]}`}>{ST[d.status][0]}</span></span>)}</div>}
      </section>
      <div className="flex flex-wrap gap-2">
        <button disabled={!!busy} onClick={() => save(false)} className="btn-ghost">{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره پیش‌نویس</button>
        <button disabled={!!busy} onClick={() => save(true)} className="btn-primary">{busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}ارسال برای بررسی و احراز هویت</button>
      </div>
    </div>
  );
}
