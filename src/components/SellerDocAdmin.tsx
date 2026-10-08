"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Lock, Unlock, X } from "lucide-react";
import { api, toast } from "./client";

export function RequestDocForm({ sellerId, docTypes }: { sellerId: number; docTypes: [string, string][] }) {
  const router = useRouter();
  const [f, setF] = useState({ type: "other", title: "", note: "", dueDays: 7, restrict: true });
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <label className="block">نوع مدرک<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, title: e.target.value === "other" ? f.title : docTypes.find((d) => d[0] === e.target.value)?.[1] ?? "" })} className="input mt-1">{docTypes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="block">عنوان مدرک درخواستی<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثلاً: گواهی نمایندگی رسمی برند" className="input mt-1" /></label>
      <label className="block">توضیح برای تأمین‌کننده<textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="input mt-1 min-h-16" /></label>
      <label className="block">مهلت (روز، ۰ = بدون مهلت)<input type="number" min={0} value={f.dueDays} onChange={(e) => setF({ ...f, dueDays: Number(e.target.value) })} className="input mt-1" /></label>
      <label className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-rose-800"><input type="checkbox" className="mt-1" checked={f.restrict} onChange={(e) => setF({ ...f, restrict: e.target.checked })} /><span><b>محدودسازی دسترسی تا بارگذاری مدرک</b><span className="block text-xs">ثبت محصول/پیشنهاد، RFQ و برداشت مسدود و پیشنهادها از فروشگاه پنهان می‌شوند.</span></span></label>
      <button disabled={busy} className="btn-primary w-full" onClick={async () => {
        setBusy(true);
        try { await api(`/api/admin/sellers/${sellerId}/documents/request`, "POST", f); toast("درخواست ارسال و به تأمین‌کننده اعلان شد"); setF({ ...f, title: "", note: "" }); router.refresh(); }
        catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
      }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}ارسال درخواست مدرک</button>
    </div>
  );
}

export function DocReviewButtons({ docId, hasFile }: { docId: number; hasFile: boolean }) {
  const router = useRouter();
  const [rej, setRej] = useState(false);
  const [note, setNote] = useState("");
  const [restrict, setRestrict] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (action: "approve" | "reject") => {
    setBusy(true);
    try { await api(`/api/admin/seller-documents/${docId}/review`, "POST", { action, note, restrict }); toast(action === "approve" ? "مدرک تأیید شد" : "مدرک رد شد"); setRej(false); router.refresh(); }
    catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="flex gap-1">
        <button disabled={busy || !hasFile} onClick={() => go("approve")} className="btn-success">تأیید</button>
        <button disabled={busy} onClick={() => setRej(true)} className="btn-danger">رد</button>
      </div>
      {rej && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4" onClick={() => setRej(false)}>
          <div className="modal-scroll-panel w-full max-w-md space-y-3 rounded-2xl bg-white p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b>رد مدرک</b><button onClick={() => setRej(false)}><X className="h-5 w-5" /></button></div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="دلیل رد (برای تأمین‌کننده ارسال می‌شود)" className="input min-h-20" />
            <label className="flex items-center gap-2 text-rose-700"><input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} />دسترسی تأمین‌کننده تا اصلاح مدرک محدود شود</label>
            <button disabled={busy || !note} onClick={() => go("reject")} className="btn-danger w-full !py-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت رد</button>
          </div>
        </div>
      )}
    </>
  );
}

export function RestrictToggle({ sellerId, restricted }: { sellerId: number; restricted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} className={restricted ? "btn-success" : "btn-danger"} onClick={async () => {
      const reason = restricted ? "" : window.prompt("دلیل محدودسازی:", "مدارک ناقص");
      if (!restricted && !reason) return;
      setBusy(true);
      try { await api(`/api/admin/sellers/${sellerId}/restrict`, "POST", { restricted: !restricted, reason }); toast(restricted ? "محدودیت برداشته شد" : "دسترسی‌ها محدود شد"); router.refresh(); }
      catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
    }}>{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : restricted ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{restricted ? "رفع محدودیت" : "محدودسازی دسترسی"}</button>
  );
}
