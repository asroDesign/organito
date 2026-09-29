"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { api, toast } from "./client";

type Row = { id: number; name: string; slug: string; parentId: number | null; description: string | null; sortOrder: number; products: number };

export function CategoryManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const [busy, setBusy] = useState(false);
  const roots = rows.filter((r) => !r.parentId || !rows.some((x) => x.id === r.parentId));
  const children = (id: number) => rows.filter((r) => r.parentId === id);
  const save = async () => {
    if (!edit?.name) { toast("نام الزامی است", false); return; }
    setBusy(true);
    try {
      await api(edit.id ? `/api/admin/categories/${edit.id}` : "/api/admin/categories", "POST", edit);
      toast("ذخیره شد"); setEdit(null); router.refresh();
    } catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
  };
  const del = async (r: Row) => {
    if (!window.confirm(`حذف دسته «${r.name}»؟`)) return;
    try { await api(`/api/admin/categories/${r.id}`, "POST", { delete: true }); toast("حذف شد"); router.refresh(); } catch (e) { toast((e as Error).message, false); }
  };
  const Node = ({ r, depth }: { r: Row; depth: number }) => (
    <>
      <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-slate-50" style={{ paddingRight: 12 + depth * 24 }}>
        <div className="flex items-center gap-2"><FolderTree className="h-4 w-4 text-emerald-600" /><b>{r.name}</b><span className="text-xs text-slate-400" dir="ltr">/{r.slug}</span><span className="rounded bg-slate-100 px-2 text-[11px]">{r.products.toLocaleString("fa-IR")} محصول</span></div>
        <div className="flex gap-1">
          <button className="btn-sm" onClick={() => setEdit({ parentId: r.id, name: "", sortOrder: 0 })}><Plus className="h-3 w-3" />زیردسته</button>
          <button className="btn-sm" onClick={() => setEdit(r)}><Pencil className="h-3 w-3" /></button>
          <button className="btn-sm" onClick={() => del(r)}><Trash2 className="h-3 w-3 text-rose-500" /></button>
        </div>
      </div>
      {children(r.id).map((c) => <Node key={c.id} r={c} depth={depth + 1} />)}
    </>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        {rows.length === 0 ? <p className="text-sm text-slate-500">دسته‌ای تعریف نشده است.</p> : roots.map((r) => <Node key={r.id} r={r} depth={0} />)}
      </div>
      <div className="h-fit space-y-3 rounded-2xl bg-slate-50 p-4">
        <b>{edit?.id ? "ویرایش دسته" : "دسته جدید"}</b>
        <input value={edit?.name ?? ""} onChange={(e) => setEdit({ ...(edit ?? {}), name: e.target.value })} placeholder="نام دسته" className="input" />
        <input value={edit?.slug ?? ""} onChange={(e) => setEdit({ ...(edit ?? {}), slug: e.target.value })} placeholder="Slug (اختیاری)" dir="ltr" className="input" />
        <select value={edit?.parentId ?? ""} onChange={(e) => setEdit({ ...(edit ?? {}), parentId: e.target.value ? Number(e.target.value) : null })} className="input">
          <option value="">— دسته اصلی —</option>{rows.filter((r) => r.id !== edit?.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input type="number" value={edit?.sortOrder ?? 0} onChange={(e) => setEdit({ ...(edit ?? {}), sortOrder: Number(e.target.value) })} placeholder="ترتیب" className="input" />
        <textarea value={edit?.description ?? ""} onChange={(e) => setEdit({ ...(edit ?? {}), description: e.target.value })} placeholder="توضیحات" className="input min-h-20" />
        <div className="flex gap-2"><button disabled={busy} onClick={save} className="btn-primary flex-1">{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره</button>{edit && <button className="btn-ghost" onClick={() => setEdit(null)}>انصراف</button>}</div>
      </div>
    </div>
  );
}
