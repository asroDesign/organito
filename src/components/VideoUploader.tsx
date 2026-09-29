"use client";
import { useState } from "react";
import { Film, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "./client";

/** Product video upload (MP4/WebM up to 40MB), streamed back through /api/media with Range support. */
export function VideoUploader({ value, onChange, kind = "video", label = "ویدیوی معرفی محصول", accept = "video/mp4,video/webm" }: { value: number | null; onChange: (id: number | null) => void; kind?: string; label?: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const upload = (file: File) => new Promise<void>((resolve) => {
    setBusy(true); setPct(0);
    const fd = new FormData(); fd.append("file", file); fd.append("kind", kind);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media"); xhr.setRequestHeader("x-csrf", "1");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => { try { const j = JSON.parse(xhr.responseText); if (xhr.status < 300) onChange(j.id); else toast(j.error ?? "خطا در بارگذاری", false); } catch { toast("خطا در بارگذاری", false); } setBusy(false); resolve(); };
    xhr.onerror = () => { toast("خطای شبکه", false); setBusy(false); resolve(); };
    xhr.send(fd);
  });
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-4">
      <b className="mb-2 flex items-center gap-2 text-sm"><Film className="h-4 w-4 text-emerald-600" />{label}</b>
      {value ? (
        <div className="space-y-2">
          <video src={`/api/media/${value}`} controls preload="metadata" className="aspect-video w-full max-w-lg rounded-xl bg-black" />
          <button type="button" onClick={() => onChange(null)} className="btn-sm"><Trash2 className="h-3 w-3 text-rose-500" />حذف ویدیو</button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl bg-slate-50 p-6 text-sm text-slate-500 hover:bg-emerald-50">
          {busy ? <><Loader2 className="h-6 w-6 animate-spin text-emerald-600" />در حال بارگذاری {pct.toLocaleString("fa-IR")}٪<div className="h-1.5 w-48 overflow-hidden rounded bg-slate-200"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div></> : <><Upload className="h-6 w-6" />انتخاب فایل (حداکثر ۴۰ مگابایت)</>}
          <input type="file" hidden accept={accept} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
