"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { api, toast } from "./client";

export function HeroEditor({ initial }: { initial: { heroMediaId: number; heroType: string; heroTitle: string; heroSubtitle: string } }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(0);
  const upload = (file: File) => {
    const fd = new FormData(); fd.append("file", file); fd.append("kind", "hero");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media"); xhr.setRequestHeader("x-csrf", "1");
    xhr.upload.onprogress = (e) => e.lengthComputable && setUp(Math.max(1, Math.round((e.loaded / e.total) * 100)));
    xhr.onload = () => { const j = JSON.parse(xhr.responseText || "{}"); if (xhr.status < 300) setF({ ...f, heroMediaId: j.id, heroType: j.mime.startsWith("video/") ? "video" : j.mime === "image/gif" ? "gif" : "image" }); else toast(j.error ?? "خطا", false); setUp(0); };
    xhr.onerror = () => { toast("خطای شبکه", false); setUp(0); };
    setUp(1); xhr.send(fd);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-emerald-950">
        {f.heroMediaId ? (f.heroType === "video" ? <video src={`/api/media/${f.heroMediaId}`} autoPlay muted loop playsInline className="h-full w-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/media/${f.heroMediaId}`} alt="" className="h-full w-full object-cover" />)
          : /* eslint-disable-next-line @next/next/no-img-element */ <img src="/images/hero-organic.jpg" alt="" className="h-full w-full object-cover opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-l from-emerald-950/90 to-transparent" />
        <div className="absolute inset-y-0 right-0 flex w-2/3 flex-col justify-center gap-2 p-5 text-white"><b className="text-lg leading-7">{f.heroTitle}</b><p className="line-clamp-2 text-xs text-emerald-50/80">{f.heroSubtitle}</p></div>
        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700">{f.heroMediaId ? (f.heroType === "video" ? "ویدیو" : f.heroType === "gif" ? "GIF" : "تصویر") : "پیش‌فرض"}</span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <label className="btn-primary cursor-pointer">{up ? <><Loader2 className="h-4 w-4 animate-spin" />{up.toLocaleString("fa-IR")}٪</> : <><Upload className="h-4 w-4" />بارگذاری تصویر، GIF یا ویدیو</>}<input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = ""; }} /></label>
          {f.heroMediaId > 0 && <button type="button" className="btn-ghost" onClick={() => setF({ ...f, heroMediaId: 0, heroType: "image" })}><Trash2 className="h-4 w-4" />بازگشت به تصویر پیش‌فرض</button>}
        </div>
        <p className="flex items-center gap-1 text-xs text-slate-500"><ImageIcon className="h-3.5 w-3.5" />ویدیو به‌صورت خودکار، بی‌صدا و تکرارشونده پخش می‌شود (MP4/WebM تا ۴۰ مگابایت).</p>
        <label className="block">تیتر هیرو<input value={f.heroTitle} onChange={(e) => setF({ ...f, heroTitle: e.target.value })} className="input mt-1" /></label>
        <label className="block">متن زیر تیتر<textarea value={f.heroSubtitle} onChange={(e) => setF({ ...f, heroSubtitle: e.target.value })} className="input mt-1 min-h-20" /></label>
        <button disabled={busy || up > 0} className="btn-primary" onClick={async () => { setBusy(true); try { await api("/api/admin/hero", "POST", f); toast("هیرو صفحه اصلی ذخیره شد"); router.refresh(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره هیرو</button>
      </div>
    </div>
  );
}
