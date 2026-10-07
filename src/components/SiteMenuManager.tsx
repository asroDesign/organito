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
  const parents = items.filter((item) => item.id !== draft?.id && !items.some((candidate) => candidate.parentId === item.id && candidate.id === draft?.id));
  const patch = (value: Partial<MenuItem>) => setDraft((old) => old ? { ...old, ...value } : old);
  const refreshItem = (item: MenuItem) => setMenus((old) => old.map((m) => m.id === item.menuId ? { ...m, items: m.items.some((x) => x.id === item.id) ? m.items.map((x) => x.id === item.id ? item : x) : [...m.items, item] } : m));
  const save = async () => {
    if (!draft || !menu) return;
    setBusy(true);
    try {
      const saved = await api<MenuItem>(draft.id ? `/api/admin/site-menu-items/${draft.id}` : "/api/admin/site-menus", "POST", { ...draft, placement });
      refreshItem(saved); setDraft(null); toast("آیتم منو ذخیره شد");
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  };
  const move = async (item: MenuItem, direction: -1 | 1) => {
    const siblings = items.filter((x) => x.parentId === item.parentId), index = siblings.findIndex((x) => x.id === item.id), other = siblings[index + direction];
    if (!other) return;
    const first = { ...item, sortOrder: other.sortOrder }, second = { ...other, sortOrder: item.sortOrder };
    try {
      await Promise.all([api(`/api/admin/site-menu-items/${first.id}`, "POST", first), api(`/api/admin/site-menu-items/${second.id}`, "POST", second)]);
      setMenus((old) => old.map((m) => m.id === menu?.id ? { ...m, items: m.items.map((x) => x.id === first.id ? first : x.id === second.id ? second : x) } : m));
    } catch (error) { toast((error as Error).message, false); }
  };
  const drop = async (target: MenuItem) => {
    if (!dragId || dragId === target.id) return;
    const dragged = items.find((item) => item.id === dragId);
    if (!dragged || dragged.parentId !== target.parentId) { toast("جابجایی فقط بین آیتم‌های هم‌سطح انجام می‌شود", false); return; }
    const siblings = items.filter((item) => item.parentId === target.parentId), from = siblings.findIndex((item) => item.id === dragId), to = siblings.findIndex((item) => item.id === target.id);
    const reordered = [...siblings]; const [picked] = reordered.splice(from, 1); reordered.splice(to, 0, picked);
    try {
      const updated = await Promise.all(reordered.map((item, index) => api<MenuItem>(`/api/admin/site-menu-items/${item.id}`, "POST", { ...item, sortOrder: index * 10 })));
      setMenus((old) => old.map((m) => m.id === menu?.id ? { ...m, items: m.items.map((item) => updated.find((u) => u.id === item.id) ?? item) } : m));
    } catch (error) { toast((error as Error).message, false); }
    setDragId(null);
  };
  const remove = async (item: MenuItem) => {
    if (!window.confirm(`«${item.label}» از منو حذف شود؟`)) return;
    try { await api(`/api/admin/site-menu-items/${item.id}`, "POST", { delete: true }); setMenus((old) => old.map((m) => m.id === item.menuId ? { ...m, items: m.items.filter((x) => x.id !== item.id && x.parentId !== item.id) } : m)); toast("آیتم از نمایش منو حذف شد"); }
    catch (error) { toast((error as Error).message, false); }
  };
  const toggleMenu = async () => {
    if (!menu) return;
    try { const result = await api<{ enabled: boolean }>("/api/admin/site-menus", "POST", { placement, action: "toggle", enabled: !menu.enabled }); setMenus((old) => old.map((m) => m.id === menu.id ? { ...m, enabled: result.enabled } : m)); }
    catch (error) { toast((error as Error).message, false); }
  };
  const renderItems = (parentId: number | null = null, depth = 0): ReactNode => items.filter((item) => item.parentId === parentId).map((item) => <div key={item.id} className="space-y-2" style={{ marginRight: depth * 22 }}>
    <article draggable onDragStart={() => setDragId(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => void drop(item)} className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 ${!item.enabled ? "opacity-50" : ""}`}>
      <GripVertical className="size-4 cursor-grab text-slate-400"/><div className="min-w-0 flex-1"><b className="block truncate">{item.label}</b><small className="text-slate-500" dir="ltr">{item.href || `گروه ${item.groupTitle || "بدون پیوند"}`}</small></div>
      {item.targetBlank && <ExternalLink className="size-4 text-slate-400"/>}<button type="button" className="btn-sm" aria-label="جابجایی به بالا" onClick={() => void move(item, -1)}><ArrowUp className="size-4"/></button><button type="button" className="btn-sm" aria-label="جابجایی به پایین" onClick={() => void move(item, 1)}><ArrowDown className="size-4"/></button>
      <button type="button" className="btn-sm" onClick={() => setDraft({ ...item })}>ویرایش</button><button type="button" className="btn-sm text-rose-600" onClick={() => void remove(item)}><Trash2 className="size-4"/>حذف</button>
    </article>
    {depth < 2 && renderItems(item.id, depth + 1)}
  </div>);
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><div className="flex flex-wrap gap-2">{(["header", "footer", "mobile"] as Placement[]).map((p) => <button key={p} type="button" onClick={() => { setPlacement(p); setDraft(null); }} className={placement === p ? "btn-primary" : "btn-ghost"}>{placementText[p]}</button>)}</div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><h2 className="font-extrabold">{menu?.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">آیتم‌ها را بکشید تا جابه‌جا شوند؛ با دکمه‌های جهت‌دار نیز می‌توانید ترتیب را تغییر دهید. هر منو تا سه سطح زیرمنو دارد.</p></div><div className="flex gap-2"><button type="button" onClick={() => void toggleMenu()} className={menu?.enabled ? "btn-ghost" : "btn-primary"}>{menu?.enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}</button><button type="button" onClick={() => setDraft(emptyItem(menu!.id, items.length * 10))} className="btn-primary"><Plus className="size-4"/>افزودن آیتم</button></div></div>
      <div className="mt-4 space-y-2">{renderItems()}{!items.length && <p className="rounded-xl border border-dashed p-7 text-center text-sm text-slate-500">این جایگاه هنوز منویی ندارد. لینک‌های پیش‌فرض سایت تا افزودن آیتم جدید نمایش داده می‌شوند.</p>}</div>
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
