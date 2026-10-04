"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, ThumbsUp, ThumbsDown, Plus, Minus, X, Loader2, ImagePlus, MessageCircleQuestion, CheckCircle2, ShieldCheck } from "lucide-react";
import { api, toast } from "./client";
import { Modal } from "./Modal";

const fa = (n: number) => n.toLocaleString("fa-IR");

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return <span className="inline-flex" dir="ltr">{[1, 2, 3, 4, 5].map((i) => <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"} />)}</span>;
}

function ListInput({ label, tone, items, setItems }: { label: string; tone: "pro" | "con"; items: string[]; setItems: (v: string[]) => void }) {
  const [v, setV] = useState("");
  const color = tone === "pro" ? "text-emerald-600" : "text-rose-600";
  const addIt = () => { const t = v.trim(); if (t && items.length < 8) { setItems([...items, t]); setV(""); } };
  return (
    <div>
      <b className={`mb-1.5 flex items-center gap-1 text-xs ${color}`}>{tone === "pro" ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}{label}</b>
      <div className="flex gap-2"><input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIt(); } }} placeholder={tone === "pro" ? "مثلاً: طعم عالی" : "مثلاً: بسته‌بندی ضعیف"} className="input" /><button type="button" onClick={addIt} className="btn-sm">افزودن</button></div>
      <ul className="mt-2 space-y-1">{items.map((it, i) => <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-xs"><span className={color}>{tone === "pro" ? "+" : "−"} <span>{it}</span></span><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="h-3 w-3 text-slate-400" /></button></li>)}</ul>
    </div>
  );
}

export function ReviewForm({ productId, loggedIn, productName }: { productId: number; loggedIn: boolean; productName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [f, setF] = useState({ title: "", body: "" });
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [imgs, setImgs] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  if (!loggedIn) return <Link href="/login" className="btn-primary">برای ثبت نظر وارد شوید</Link>;
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setUp(true);
    const ids = [...imgs];
    for (const file of Array.from(files).slice(0, 5 - ids.length)) {
      const fd = new FormData(); fd.append("file", file); fd.append("kind", "image");
      const r = await fetch("/api/media", { method: "POST", body: fd, headers: { "x-csrf": "1" } }); const j = await r.json();
      if (r.ok) ids.push(j.id); else toast(j.error, false);
    }
    setImgs(ids); setUp(false);
  };
  const labels = ["", "خیلی بد", "بد", "معمولی", "خوب", "عالی"];
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Star className="h-4 w-4" />ثبت دیدگاه</button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="qv-in my-8 w-full max-w-2xl space-y-5 rounded-[2rem] bg-white p-6">
            <div className="flex items-start justify-between"><div><b className="text-lg text-emerald-950">دیدگاه شما درباره</b><div className="text-sm text-slate-500">{productName}</div></div><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-[#faf7ef] p-4">
              <div className="flex gap-1" dir="ltr" onMouseLeave={() => setHover(0)}>{[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" onMouseEnter={() => setHover(i)} onClick={() => setRating(i)}><Star className={`h-9 w-9 transition ${(hover || rating) >= i ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>)}</div>
              <span className="text-sm font-bold text-amber-700">{labels[hover || rating] || "امتیاز دهید"}</span>
            </div>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="عنوان دیدگاه (اختیاری)" className="input" />
            <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="تجربه خود از طعم، کیفیت، بسته‌بندی و ارسال را بنویسید…" className="input min-h-28" />
            <div className="grid gap-4 sm:grid-cols-2"><ListInput label="نقاط قوت" tone="pro" items={pros} setItems={setPros} /><ListInput label="نقاط ضعف" tone="con" items={cons} setItems={setCons} /></div>
            <div>
              <b className="mb-2 block text-xs text-slate-600">تصاویر شما (حداکثر ۵)</b>
              <div className="flex flex-wrap gap-2">
                {imgs.map((id) => <div key={id} className="relative h-20 w-20 overflow-hidden rounded-xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${id}`} alt="" className="h-full w-full object-cover" /><button onClick={() => setImgs(imgs.filter((x) => x !== id))} className="absolute left-1 top-1 rounded-full bg-white/90 p-0.5"><X className="h-3 w-3" /></button></div>)}
                {imgs.length < 5 && <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-emerald-400">{up ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-6 w-6" />}<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files)} /></label>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-600">خرید این محصول را به دیگران</span>
              {([[true, "پیشنهاد می‌کنم"], [false, "پیشنهاد نمی‌کنم"]] as const).map(([v, l]) => <button key={l} type="button" onClick={() => setRecommend(v)} className={`rounded-full px-3 py-1 text-xs ring-1 ${recommend === v ? (v ? "bg-emerald-600 text-white ring-emerald-600" : "bg-rose-600 text-white ring-rose-600") : "ring-slate-200"}`}>{l}</button>)}
            </div>
            <button disabled={busy || !rating || f.body.trim().length < 10} className="btn-primary w-full !py-3" onClick={async () => {
              setBusy(true);
              try { const r = await api<{ status: string }>(`/api/products/${productId}/reviews`, "POST", { rating, ...f, pros, cons, recommend, mediaIds: imgs }); toast(r.status === "approved" ? "دیدگاه شما منتشر شد" : "دیدگاه شما ثبت شد و پس از بررسی منتشر می‌شود"); setOpen(false); router.refresh(); }
              catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
            }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت دیدگاه</button>
            <p className="text-center text-[11px] text-slate-400">{!rating ? "امتیاز را انتخاب کنید. " : ""}{f.body.trim().length < 10 ? "متن دیدگاه حداقل ۱۰ کاراکتر باشد." : ""}</p>
          </div>
        </div>
      )}
    </>
  );
}

export function VoteButtons({ id, helpful, notHelpful, loggedIn }: { id: number; helpful: number; notHelpful: number; loggedIn: boolean }) {
  const [c, setC] = useState({ helpful, notHelpful });
  const [mine, setMine] = useState<boolean | null>(null);
  const vote = async (up: boolean) => {
    if (!loggedIn) { toast("برای رأی دادن وارد شوید", false); return; }
    try { const r = await api<{ helpful: number; notHelpful: number }>(`/api/reviews/${id}/vote`, "POST", { up }); setC(r); setMine(up); } catch (e) { toast((e as Error).message, false); }
  };
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500"><span>مفید بود؟</span>
      <button onClick={() => vote(true)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 ${mine === true ? "bg-emerald-50 text-emerald-700 ring-emerald-300" : "ring-slate-200 hover:bg-slate-50"}`}><ThumbsUp className="h-3.5 w-3.5" />{fa(c.helpful)}</button>
      <button onClick={() => vote(false)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 ${mine === false ? "bg-rose-50 text-rose-700 ring-rose-300" : "ring-slate-200 hover:bg-slate-50"}`}><ThumbsDown className="h-3.5 w-3.5" />{fa(c.notHelpful)}</button>
    </div>
  );
}

export function ReviewImages({ ids }: { ids: number[] }) {
  const [z, setZ] = useState<number | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">{ids.map((id) => <button key={id} onClick={() => setZ(id)} className="h-20 w-20 overflow-hidden rounded-xl ring-1 ring-slate-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${id}`} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-110" /></button>)}</div>
      {z && <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/90 p-4" onClick={() => setZ(null)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/media/${z}`} alt="" className="max-h-[90vh] max-w-[95vw] rounded-2xl" /></div>}
    </>
  );
}

export function QuestionForm({ productId, loggedIn }: { productId: number; loggedIn: boolean }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  if (!loggedIn) return <div className="rounded-2xl bg-[#faf7ef] p-4 text-sm">برای ثبت پرسش <Link href="/login" className="font-bold text-emerald-700">وارد شوید</Link>.</div>;
  return (
    <div className="rounded-2xl bg-[#faf7ef] p-4">
      <b className="mb-2 flex items-center gap-2 text-sm text-emerald-950"><MessageCircleQuestion className="h-4 w-4" />پرسش خود را درباره این محصول بپرسید</b>
      <textarea value={v} onChange={(e) => setV(e.target.value)} placeholder="مثلاً: آیا این عسل برای کودکان زیر یک سال مناسب است؟" className="input min-h-20" />
      <div className="mt-2 flex items-center justify-between"><span className="text-[11px] text-slate-400">پرسش‌ها پس از بررسی نمایش داده می‌شوند.</span>
        <button disabled={busy || v.trim().length < 5} className="btn-primary" onClick={async () => { setBusy(true); try { await api(`/api/products/${productId}/questions`, "POST", { body: v }); toast("پرسش شما ثبت شد"); setV(""); router.refresh(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت پرسش</button>
      </div>
    </div>
  );
}

export function AnswerForm({ questionId, loggedIn, label = "پاسخ می‌دهم" }: { questionId: number; loggedIn: boolean; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  if (!loggedIn) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs font-bold text-emerald-700 hover:underline">{label}</button>
      {open && <Modal title="پاسخ به پرسش" onClose={() => setOpen(false)}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setBusy(true); try { const r = await api<{ status: string }>(`/api/questions/${questionId}/answers`, "POST", { body: v }); toast(r.status === "approved" ? "پاسخ منتشر شد" : "پاسخ ثبت شد و پس از بررسی نمایش داده می‌شود"); setV(""); setOpen(false); router.refresh(); } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); } }}><label className="block text-sm font-bold">متن پاسخ<textarea autoFocus required minLength={2} maxLength={2000} value={v} onChange={(e) => setV(e.target.value)} placeholder="پاسخ خود را بنویسید…" className="input mt-2 min-h-32" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button disabled={busy || v.trim().length < 2} className="btn-primary">{busy && <Loader2 className="size-4 animate-spin" />}ثبت پاسخ</button></div></form></Modal>}
    </>
  );
}

export function ReviewReplyButton({ reviewId, status, initialReply }: { reviewId: number; status: string; initialReply: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialReply ?? "");
  const [busy, setBusy] = useState(false);
  return <><button type="button" className="btn-sm" onClick={() => setOpen(true)}>{initialReply ? "ویرایش پاسخ" : "پاسخ"}</button>{open && <Modal title="پاسخ فروشگاه به دیدگاه" onClose={() => setOpen(false)}><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setBusy(true); try { await api(`/api/admin/reviews/${reviewId}`, "POST", { status, adminReply: value }); toast("پاسخ فروشگاه ذخیره شد"); setOpen(false); router.refresh(); } catch (error) { toast((error as Error).message, false); } finally { setBusy(false); } }}><label className="block text-sm font-bold">متن پاسخ<textarea autoFocus maxLength={1000} value={value} onChange={(e) => setValue(e.target.value)} placeholder="پاسخ محترمانه و روشن فروشگاه…" className="input mt-2 min-h-32" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button disabled={busy} className="btn-primary">{busy && <Loader2 className="size-4 animate-spin" />}ذخیره پاسخ</button></div></form></Modal>}</>;
}

export const RoleBadge = ({ role }: { role: string }) => role === "staff" ? <span className="flex items-center gap-0.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white"><ShieldCheck className="h-3 w-3" />پاسخ فروشگاه</span>
  : role === "seller" ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">تولیدکننده</span>
  : <span className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"><CheckCircle2 className="h-3 w-3" />کاربر</span>;
