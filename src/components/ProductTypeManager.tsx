"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { api, toast } from "./client";

type ProductType = { name: string; parameters: string[] };
export function ProductTypeManager({ initial }: { initial: ProductType[] }) {
  const router = useRouter();
  const [types, setTypes] = useState<ProductType[]>(initial ?? []);
  const [newName, setNewName] = useState("");
  const [newParams, setNewParams] = useState("");
  const [busy, setBusy] = useState(false);
  const addType = () => {
    const name = newName.trim();
    if (!name || types.some((t) => t.name === name)) return;
    setTypes([...types, { name, parameters: [...new Set(newParams.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean))] }]);
    setNewName(""); setNewParams("");
  };
  async function save() {
    setBusy(true);
    try { await api("/api/admin/settings", "POST", { productTypes: types }); toast("نوع محصولات ذخیره شد"); router.refresh(); }
    catch (e) { toast((e as Error).message, false); }
    finally { setBusy(false); }
  }
  return <div>
    <p className="mb-4 text-sm text-slate-500">نوع محصول در فرم محصول اختیاری است. پارامترها پس از انتخاب نوع، به‌عنوان مشخصه‌های پیشنهادی در دسترس قرار می‌گیرند.</p>
    <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
      <label className="text-sm">نام نوع<input className="input mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مثلاً عسل" /></label>
      <label className="text-sm">پارامترها (با کاما جدا کنید)<input className="input mt-1" value={newParams} onChange={(e) => setNewParams(e.target.value)} placeholder="منطقه برداشت، نوع گل، روش فرآوری" /></label>
      <button type="button" className="btn-sm self-end" onClick={addType}><Plus className="h-4 w-4" />افزودن نوع</button>
    </div>
    <div className="mt-4 space-y-2">{types.map((t, i) => <div key={`${t.name}-${i}`} className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-[1fr_2fr_auto]">
      <input aria-label="نام نوع" className="input" value={t.name} onChange={(e) => setTypes(types.map((x, n) => n === i ? { ...x, name: e.target.value } : x))} />
      <input aria-label="پارامترها" className="input" value={t.parameters.join("، ")} onChange={(e) => setTypes(types.map((x, n) => n === i ? { ...x, parameters: [...new Set(e.target.value.split(/[,،]/).map((v) => v.trim()).filter(Boolean))] } : x))} />
      <button type="button" className="btn-sm text-rose-600" aria-label="حذف نوع" onClick={() => setTypes(types.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" />حذف</button>
    </div>)}{!types.length && <p className="text-sm text-slate-400">هنوز نوعی تعریف نشده است.</p>}</div>
    <button type="button" disabled={busy} className="btn-primary mt-4" onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره نوع‌ها و پارامترها</button>
  </div>;
}
