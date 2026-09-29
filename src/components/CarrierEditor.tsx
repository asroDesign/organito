"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { JsonForm } from "./client";

type C = { id: number; name: string; trackingUrl: string; baseCost: number; perKgCost: number; freeThreshold: number; minDays: number; maxDays: number; sortOrder: number };
export function CarrierEditor({ c }: { c: C }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-sm" onClick={() => setOpen(true)}>ویرایش</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-between"><b>ویرایش {c.name}</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <JsonForm url={`/api/admin/carriers/${c.id}`} submit="ذخیره" resetOnDone={false} onDone={() => setOpen(false)} fields={[
              { name: "name", label: "نام", required: true, defaultValue: c.name }, { name: "trackingUrl", label: "آدرس رهگیری", defaultValue: c.trackingUrl },
              { name: "baseCost", label: "هزینه پایه", type: "number", half: true, defaultValue: c.baseCost }, { name: "perKgCost", label: "هر کیلو اضافه", type: "number", half: true, defaultValue: c.perKgCost },
              { name: "freeThreshold", label: "ارسال رایگان از", type: "number", half: true, defaultValue: c.freeThreshold }, { name: "sortOrder", label: "ترتیب", type: "number", half: true, defaultValue: c.sortOrder },
              { name: "minDays", label: "حداقل روز", type: "number", half: true, defaultValue: c.minDays }, { name: "maxDays", label: "حداکثر روز", type: "number", half: true, defaultValue: c.maxDays },
            ]} />
          </div>
        </div>
      )}
    </>
  );
}
