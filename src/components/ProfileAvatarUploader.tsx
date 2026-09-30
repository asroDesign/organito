"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { api, toast } from "./client";

export function ProfileAvatarUploader({ initial }: { initial: number | null }) {
  const [id, setId] = useState(initial), [busy, setBusy] = useState(false); const ref = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => { if (!file) return; setBusy(true); try { const fd = new FormData(); fd.append("file", file); fd.append("kind", "profile"); const r = await fetch("/api/media", { method: "POST", headers: { "x-csrf": "1" }, body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "بارگذاری انجام نشد"); await api("/api/me/avatar", "POST", { mediaId: j.id }); setId(j.id); toast("تصویر پروفایل ذخیره شد"); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); if (ref.current) ref.current.value = ""; } };
  const remove = async () => { setBusy(true); try { await api("/api/me/avatar", "POST", { mediaId: null }); setId(null); toast("تصویر پروفایل حذف شد"); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } };
  return <div className="flex flex-wrap items-center gap-4"><div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-emerald-50 ring-4 ring-white shadow">{id ? <img src={`/api/media/${id}`} alt="تصویر پروفایل" className="h-full w-full object-cover" /> : <Camera className="h-8 w-8 text-emerald-500" />}</div><div className="space-y-2"><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>upload(e.target.files?.[0])}/><button type="button" disabled={busy} onClick={()=>ref.current?.click()} className="btn-primary">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Camera className="h-4 w-4"/>}انتخاب تصویر</button>{id&&<button type="button" disabled={busy} onClick={remove} className="btn-ghost mr-2 text-rose-600"><Trash2 className="h-4 w-4"/>حذف</button>}<p className="text-xs text-slate-500">JPG، PNG یا WebP تا ۳ مگابایت</p></div></div>;
}
