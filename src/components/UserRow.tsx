"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "./client";

export function UserRow({ id, role, active, extra, roles, perms, self }: { id: number; role: string; active: boolean; extra: string[]; roles: [string, string][]; perms: string[]; self: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [r, setR] = useState(role);
  const [ex, setEx] = useState<string[]>(extra);
  const save = async (patch: Record<string, unknown>) => {
    try { await api(`/api/admin/users/${id}`, "POST", patch); toast("ذخیره شد"); router.refresh(); } catch (e) { toast((e as Error).message, false); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button className="btn-sm" onClick={() => setOpen(!open)}>ویرایش</button>
        {!self && <button className="btn-sm" onClick={() => save({ isActive: !active })}>{active ? "غیرفعال" : "فعال"}</button>}
      </div>
      {open && (
        <div className="w-72 space-y-2 rounded-xl border bg-slate-50 p-2">
          {role !== "seller" && <select value={r} onChange={(e) => setR(e.target.value)} className="input">{roles.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
          <div className="grid max-h-40 grid-cols-1 gap-0.5 overflow-y-auto text-[10px]" dir="ltr">
            {perms.map((p) => <label key={p} className="flex items-center gap-1"><input type="checkbox" checked={ex.includes(p)} onChange={(e) => setEx(e.target.checked ? [...ex, p] : ex.filter((x) => x !== p))} />{p}</label>)}
          </div>
          <button className="btn-primary w-full !py-1" onClick={() => save({ role: r, extraPermissions: ex })}>ذخیره نقش و مجوزهای اضافه</button>
        </div>
      )}
    </div>
  );
}
