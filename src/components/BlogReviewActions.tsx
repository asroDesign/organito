"use client";
import { useState } from "react";
import { Check, Loader2, MessageSquareText } from "lucide-react";
import { api, toast } from "./client";

export function BlogReviewActions({ postId }: { postId: number }) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = async (reviewAction: "approve" | "request_changes") => {
    if (reviewAction === "request_changes" && !note.trim()) { toast("برای درخواست اصلاح، توضیح بازبینی را بنویسید", false); return; }
    setBusy(true);
    try { await api(`/api/admin/blog/${postId}`, "POST", { reviewAction, reviewNote: note }); toast(reviewAction === "approve" ? "مقاله تأیید و منتشر شد" : "مقاله برای اصلاح به نویسنده برگشت"); location.reload(); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  return <div className="flex min-w-52 flex-col gap-2">
    <button type="button" disabled={busy} onClick={() => void act("approve")} className="btn-sm text-emerald-700"><Check className="size-3.5"/>تأیید و انتشار</button>
    {showNote ? <><textarea className="input min-h-16 text-xs" value={note} onChange={e => setNote(e.target.value)} placeholder="چه چیزی باید اصلاح شود؟"/><div className="flex gap-1"><button type="button" disabled={busy} onClick={() => void act("request_changes")} className="btn-sm text-amber-800">{busy ? <Loader2 className="size-3.5 animate-spin"/> : <MessageSquareText className="size-3.5"/>}ارسال درخواست اصلاح</button><button type="button" className="btn-sm" onClick={() => setShowNote(false)}>انصراف</button></div></> : <button type="button" disabled={busy} onClick={() => setShowNote(true)} className="btn-sm text-amber-800">درخواست اصلاح</button>}
  </div>;
}
