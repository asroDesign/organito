"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, FileText, Package, RefreshCw, Search, Tags, Trash2 } from "lucide-react";
import { api, toast } from "./client";

type TrashKind = "product" | "blog" | "brand" | "page";
type TrashRow = { kind: TrashKind; id: number; title: string; detail: string; deletedAt: string | Date | null; deletedBy: number | null };
const kindLabels: Record<TrashKind, string> = { product: "محصول", blog: "مقاله", brand: "برند", page: "صفحه" };
const kindIcons = { product: Package, blog: FileText, brand: Tags, page: FileText };

export function TrashManager() {
  const [rows, setRows] = useState<TrashRow[]>([]), [loading, setLoading] = useState(true), [restoring, setRestoring] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrashKind | "all">("all"), [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api<TrashRow[]>("/api/admin/trash", "GET")); }
    catch (error) { toast((error as Error).message || "بارگذاری زباله انجام نشد", false); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void api<TrashRow[]>("/api/admin/trash", "GET").then((data) => { if (active) setRows(data); })
      .catch((error) => { if (active) toast((error as Error).message || "بارگذاری زباله انجام نشد", false); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => rows.filter((row) => (filter === "all" || row.kind === filter) && `${row.title} ${row.detail} ${kindLabels[row.kind]}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [rows, filter, query]);
  async function restore(row: TrashRow) {
    const key = `${row.kind}:${row.id}`;
    if (!window.confirm(`«${row.title}» به وضعیت قبلی برگردد و دوباره در دسترس قرار گیرد؟`)) return;
    setRestoring(key);
    try {
      await api(`/api/admin/trash/${row.kind}/${row.id}/restore`, "POST", { confirm: true });
      setRows((old) => old.filter((item) => item.kind !== row.kind || item.id !== row.id));
      toast(`${kindLabels[row.kind]} بازیابی شد.`);
    } catch (error) { toast((error as Error).message || "بازیابی انجام نشد", false); }
    finally { setRestoring(null); }
  }
  const counts = useMemo(() => rows.reduce((acc, row) => ({ ...acc, [row.kind]: acc[row.kind] + 1 }), { product: 0, blog: 0, brand: 0, page: 0 }), [rows]);
  const filters: { value: TrashKind | "all"; label: string }[] = [{ value: "all", label: "همه" }, { value: "product", label: "محصولات" }, { value: "blog", label: "مقالات" }, { value: "brand", label: "برندها" }, { value: "page", label: "صفحات" }];

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(["product", "blog", "brand", "page"] as const).map((kind) => { const Icon = kindIcons[kind]; return <button key={kind} type="button" onClick={() => setFilter(kind)} className={`rounded-2xl border p-4 text-right shadow-sm transition ${filter === kind ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}><span className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="size-5"/></span><b className="text-2xl">{counts[kind].toLocaleString("fa-IR")}</b></span><span className="mt-3 block text-sm font-bold">{kindLabels[kind]}‌های قابل بازیابی</span></button>; })}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-extrabold">محتوای منتقل‌شده به زباله</h2><p className="mt-1 text-xs leading-5 text-slate-500">حذف این بخش منطقی است؛ برای بازیابی، وضعیت قبلی بازمی‌گردد. سفارش‌ها، موجودی و اسناد مالی از اینجا حذف نمی‌شوند.</p></div><button type="button" onClick={() => void load()} className="btn-ghost" disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`}/>به‌روزرسانی</button></header>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"><label className="relative min-w-52 flex-1"><Search className="absolute right-3 top-3 size-4 text-slate-400"/><input className="input pr-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی عنوان یا شناسه"/></label><select className="input sm:max-w-48" value={filter} onChange={(event) => setFilter(event.target.value as TrashKind | "all")}>{filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500">در حال بارگذاری محتوا…</div> : !filtered.length ? <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Trash2 className="size-6"/></span><h3 className="mt-3 font-bold">موردی برای بازیابی پیدا نشد</h3><p className="mt-1 text-sm text-slate-500">موارد حذف‌شدهٔ این دسته در اینجا نمایش داده می‌شوند.</p></div> : <div className="divide-y divide-slate-100">{filtered.map((row) => { const Icon = kindIcons[row.kind]; const key = `${row.kind}:${row.id}`; return <article key={key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="size-5"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="truncate">{row.title}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{kindLabels[row.kind]}</span></div><p dir="auto" className="mt-1 break-all text-xs text-slate-500">{row.detail || `شناسه ${row.id.toLocaleString("fa-IR")}`} · حذف در {row.deletedAt ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.deletedAt)) : "زمان نامشخص"}</p></div><button type="button" className="btn-sm self-start text-emerald-700 sm:self-auto" disabled={restoring !== null} onClick={() => void restore(row)}>{restoring === key ? <RefreshCw className="size-4 animate-spin"/> : <ArchiveRestore className="size-4"/>}بازیابی</button></article>; })}</div>}
    </section>
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><Trash2 className="mt-0.5 size-4 shrink-0"/>حذف دائمی در این نسخه ارائه نشده تا سوابق محصولات، مقالات و فروشگاه قابل بازیابی بمانند. محصولات دارای رزرو یا سابقه فروش نیز از داده‌های عملیاتی جدا نمی‌شوند.</p>
  </div>;
}
