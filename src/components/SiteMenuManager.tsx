"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { api, toast } from "./client";
import type { ReactNode } from "react";

type Placement = "header" | "footer" | "mobile";
type MenuItem = { id: number; menuId: number; parentId: number | null; label: string; href: string | null; groupTitle: string | null; sortOrder: number; enabled: boolean; targetBlank: boolean };
type Menu = { id: number; placement: Placement; name: string; enabled: boolean; items: MenuItem[] };
const placementText: Record<Placement, string> = { header: "هدر دسکتاپ", footer: "فوتر سایت", mobile: "منوی موبایل" };
const emptyItem = (menuId: number, sortOrder: number): Omit<MenuItem, "id"> => ({ menuId, parentId: null, label: "", href: "", groupTitle: "", sortOrder, enabled: true, targetBlank: false });

export function SiteMenuManager({ initial }: { initial: Menu[] }) {
  const [menus, setMenus] = useState(initial);
  const [placement, setPlacement] = useState<Placement>("header");
  const [draft, setDraft] = useState<(Omit<MenuItem, "id"> & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const menu = menus.find((item) => item.placement === placement);
  const items = useMemo(() => [...(menu?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), [menu]);
  const subtree = new Set<number>(draft?.id ? [draft.id] : []);
  let foundDescendant = true;
  while (foundDescendant) {
    foundDescendant = false;
    for (const item of items) if (item.parentId !== null && subtree.has(item.parentId) && !subtree.has(item.id)) { subtree.add(item.id); foundDescendant = true; }
  }
  const depthOf = (id: number) => {
    let depth = 1, cursor = items.find((item) => item.id === id)?.parentId ?? null;
    const seen = new Set<number>([id]);
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor); depth++;
      cursor = items.find((item) => item.id === cursor)?.parentId ?? null;
    }
    return depth;
  };
  const subtreeHeight = draft?.id ? Math.max(0, ...[...subtree].map((id) => depthOf(id) - depthOf(draft.id!))) : 0;
  const parents = items.filter((item) => !subtree.has(item.id) && depthOf(item.id) + 1 + subtreeHeight <= 3);
  const patch = (value: Partial<MenuItem>) => setDraft((old) => old ? { ...old, ...value } : old);
  const refreshItem = (item: MenuItem) => setMenus((old) => old.map((m) => m.id === item.menuId ? { ...m, items: m.items.some((x) => x.id === item.id) ? m.items.map((x) => x.id === item.id ? item : x) : [...m.items, item] } : m));
  const save = async () => {
    if (!draft || !menu) return;
    if (!draft.label.trim()) { toast("عنوان آیتم را وارد کنید", false); return; }
    if (!draft.href?.trim() && !draft.parentId && !(placement === "footer" && draft.groupTitle?.trim())) { toast("برای آیتم اصلی نشانی لینک یا عنوان ستون فوتر لازم است", false); return; }
    setBusy(true);
    try {
      const saved = await api<MenuItem>(draft.id ? `/api/admin/site-menu-items/${draft.id}` : "/api/admin/site-menus", "POST", { ...draft, placement });
      refreshItem(saved); setDraft(null); toast("آیتم منو ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const move = async (item: MenuItem, direction: -1 | 1) => {
    const siblings = items.filter((x) => x.parentId === item.parentId), index = siblings.findIndex((x) => x.id === item.id), other = siblings[index + direction];
    if (index < 0 || !other || busy) return;
    const reordered = [...siblings];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    setBusy(true);
    try {
      await api("/api/admin/site-menus/reorder", "POST", { placement, parentId: item.parentId, ids: reordered.map((entry) => entry.id) });
      const ranks = new Map(reordered.map((entry, order) => [entry.id, order * 10]));
      setMenus((old) => old.map((m) => m.id === menu?.id ? { ...m, items: m.items.map((entry) => ranks.has(entry.id) ? { ...entry, sortOrder: ranks.get(entry.id)! } : entry) } : m));
      toast("ترتیب منو ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const drop = async (target: MenuItem) => {
    if (!dragId || dragId === target.id || busy) { setDragId(null); return; }
    const dragged = items.find((item) => item.id === dragId);
    if (!dragged || dragged.parentId !== target.parentId) { toast("جابجایی فقط بین آیتم‌های هم‌سطح انجام می‌شود", false); setDragId(null); return; }
    const siblings = items.filter((item) => item.parentId === target.parentId), from = siblings.findIndex((item) => item.id === dragId), to = siblings.findIndex((item) => item.id === target.id);
    if (from < 0 || to < 0) { setDragId(null); return; }
    const reordered = [...siblings]; const [picked] = reordered.splice(from, 1); reordered.splice(to, 0, picked);
    setBusy(true);
    try {
      await api("/api/admin/site-menus/reorder", "POST", { placement, parentId: target.parentId, ids: reordered.map((item) => item.id) });
      const ranks = new Map(reordered.map((item, index) => [item.id, index * 10]));
      setMenus((old) => old.map((m) => m.id === menu?.id ? { ...m, items: m.items.map((item) => ranks.has(item.id) ? { ...item, sortOrder: ranks.get(item.id)! } : item) } : m));
      toast("ترتیب منو ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); setDragId(null); }
  };
  const remove = async (item: MenuItem) => {
    if (!window.confirm(`«${item.label}» از منو حذف شود؟`)) return;
    const removed = new Set([item.id]);
    let changed = true;
    while (changed) { changed = false; for (const entry of items) if (entry.parentId !== null && removed.has(entry.parentId) && !removed.has(entry.id)) { removed.add(entry.id); changed = true; } }
    setBusy(true);
    try { await api(`/api/admin/site-menu-items/${item.id}`, "POST", { delete: true }); setMenus((old) => old.map((m) => m.id === item.menuId ? { ...m, items: m.items.filter((entry) => !removed.has(entry.id)) } : m)); toast("آیتم و زیرمنوهای آن حذف شدند"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const toggleMenu = async () => {
    if (!menu) return;
    setBusy(true);
    try { const result = await api<{ enabled: boolean }>("/api/admin/site-menus", "POST", { placement, action: "toggle", enabled: !menu.enabled }); setMenus((old) => old.map((m) => m.id === menu.id ? { ...m, enabled: result.enabled } : m)); toast(result.enabled ? "منو فعال شد" : "منو غیرفعال شد"); }
    catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const renderItems = (parentId: number | null = null, depth = 0): ReactNode => items.filter((item) => item.parentId === parentId).map((item) => <div key={item.id} className="space-y-2" style={{ marginRight: depth * 22 }}>
    <article draggable={!busy} onDragStart={() => setDragId(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => void drop(item)} className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 ${!item.enabled ? "opacity-50" : ""}`}>
      <GripVertical className="size-4 cursor-grab text-slate-400"/><div className="min-w-0 flex-1"><b className="block truncate">{item.label}</b><small className="text-slate-500" dir="ltr">{item.href || `گروه ${item.groupTitle || "بدون پیوند"}`}</small></div>
      {item.targetBlank && <ExternalLink className="size-4 text-slate-400"/>}<button type="button" disabled={busy} className="btn-sm disabled:opacity-50" aria-label="جابجایی به بالا" onClick={() => void move(item, -1)}><ArrowUp className="size-4"/></button><button type="button" disabled={busy} className="btn-sm disabled:opacity-50" aria-label="جابجایی به پایین" onClick={() => void move(item, 1)}><ArrowDown className="size-4"/></button>
      <button type="button" disabled={busy} className="btn-sm disabled:opacity-50" onClick={() => setDraft({ ...item })}>ویرایش</button><button type="button" disabled={busy} className="btn-sm text-rose-600 disabled:opacity-50" onClick={() => void remove(item)}><Trash2 className="size-4"/>حذف</button>
    </article>
    {depth < 2 && renderItems(item.id, depth + 1)}
  </div>);
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex flex-wrap gap-2">{(["header", "footer", "mobile"] as Placement[]).map((p) => <button key={p} type="button" disabled={busy} onClick={() => { setPlacement(p); setDraft(null); }} className={`${placement === p ? "btn-primary" : "btn-ghost"} disabled:opacity-50`}>{placementText[p]}</button>)}</div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><h2 className="font-extrabold">{menu?.name ?? placementText[placement]}</h2><p className="mt-1 text-xs leading-6 text-slate-500">آیتم‌ها را بکشید تا جابه‌جا شوند؛ با دکمه‌های جهت‌دار نیز می‌توانید ترتیب را تغییر دهید. هر منو تا سه سطح زیرمنو دارد.</p></div><div className="flex gap-2"><button type="button" disabled={!menu || busy} onClick={() => void toggleMenu()} className={menu?.enabled ? "btn-ghost" : "btn-primary"}>{menu?.enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}</button><button type="button" disabled={!menu || busy} onClick={() => menu && setDraft(emptyItem(menu.id, items.length * 10))} className="btn-primary disabled:opacity-50"><Plus className="size-4"/>افزودن آیتم</button></div></div>
      <div className="mt-4 space-y-2">{renderItems()}{!items.length && <p className="rounded-xl border border-dashed p-7 text-center text-sm leading-7 text-slate-500">{!menu ? "برای این جایگاه منویی تعریف نشده است." : !menu.enabled ? "این منو غیرفعال است و در سایت نمایش داده نمی‌شود. برای نمایش لینک‌های پیش‌فرض یا آیتم‌هایی که اضافه می‌کنید، ابتدا منو را فعال کنید." : "این منو فعال است؛ تا زمانی که آیتمی اضافه نکرده‌اید، لینک‌های پیش‌فرض سایت نمایش داده می‌شوند."}</p>}</div>
    </section>
    {draft && <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black">{draft.id ? "ویرایش آیتم" : "آیتم جدید"}</h2><button type="button" onClick={() => setDraft(null)} className="btn-ghost">بستن</button></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">متن نمایشی<input className="input mt-1" maxLength={100} value={draft.label} onChange={(e) => patch({ label: e.target.value })}/></label><label className="text-sm">نشانی لینک<input className="input mt-1" dir="ltr" placeholder="/shop یا https://example.com" value={draft.href ?? ""} onChange={(e) => patch({ href: e.target.value })}/></label>
        <label className="text-sm">والد / زیرمنو<select className="input mt-1" value={draft.parentId ?? ""} onChange={(e) => patch({ parentId: e.target.value ? Number(e.target.value) : null })}><option value="">آیتم اصلی</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.label}</option>)}</select></label>
        {placement === "footer" && !draft.parentId && <label className="text-sm">عنوان ستون فوتر<input className="input mt-1" value={draft.groupTitle ?? ""} onChange={(e) => patch({ groupTitle: e.target.value })} placeholder="دسترسی سریع"/></label>}
        <label className="text-sm">ترتیب نمایش<input className="input mt-1" type="number" min={0} value={draft.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) })}/></label>
      </div><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })}/>نمایش در سایت</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.targetBlank} onChange={(e) => patch({ targetBlank: e.target.checked })}/>بازشدن در زبانه جدید</label></div>
      <div className="flex justify-end"><button type="button" disabled={busy} onClick={() => void save()} className="btn-primary"><Save className="size-4"/>{busy ? "در حال ذخیره…" : "ذخیره آیتم"}</button></div>
    </section>}
  </div>;
}
