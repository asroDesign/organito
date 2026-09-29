"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, Inbox } from "lucide-react";
import { api } from "./client";

type N = { id: number; title: string; body: string | null; link: string | null; read: boolean; createdAt: string };

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const f = (n: number) => n.toLocaleString("fa-IR");
  if (s < 60) return "لحظاتی پیش";
  if (s < 3600) return `${f(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${f(Math.floor(s / 3600))} ساعت پیش`;
  return `${f(Math.floor(s / 86400))} روز پیش`;
}

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { items: N[]; unread: number };
      setItems(j.items); setUnread(j.unread);
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    const t = setInterval(load, 60_000);
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { clearInterval(t); document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [load]);

  const toggle = () => { const next = !open; setOpen(next); if (next) load(); };
  const openItem = async (n: N) => {
    if (!n.read) {
      setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? l);
      setUnread((u) => Math.max(0, u - 1));
      api(`/api/notifications/${n.id}/read`, "POST", {}).catch(() => null);
    }
    setOpen(false);
    if (n.link && n.link.startsWith("/")) router.push(n.link);
  };
  const readAll = async () => {
    setItems((l) => l?.map((x) => ({ ...x, read: true })) ?? l);
    setUnread(0);
    await api("/api/notifications/read", "POST", {}).catch(() => null);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-label="اعلان‌ها" aria-expanded={open} className={`relative rounded-lg p-2 transition ${open ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -left-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? "۹۹+" : unread.toLocaleString("fa-IR")}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <b className="text-sm">اعلان‌ها {unread > 0 && <span className="text-xs font-normal text-slate-500">({unread.toLocaleString("fa-IR")} خوانده‌نشده)</span>}</b>
            {unread > 0 && <button onClick={readAll} className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"><CheckCheck className="h-3.5 w-3.5" />خواندن همه</button>}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items === null ? <div className="grid h-32 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
              : items.length === 0 ? <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400"><Inbox className="h-8 w-8" />اعلانی ندارید</div>
              : items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)} className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-right transition hover:bg-slate-50 ${n.read ? "" : "bg-emerald-50/50"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-emerald-500"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? "text-slate-600" : "font-bold text-slate-900"}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-slate-400">{ago(n.createdAt)}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
