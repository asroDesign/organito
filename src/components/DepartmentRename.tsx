"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { JsonForm } from "./client";

export function DepartmentRename({ id, name, description, sortOrder }: { id: number; name: string; description: string; sortOrder: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-sm" onClick={() => setOpen(true)}>ویرایش</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-between"><b>ویرایش دپارتمان</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <JsonForm url={`/api/admin/ticket-departments/${id}`} submit="ذخیره" resetOnDone={false} onDone={() => setOpen(false)} fields={[
              { name: "name", label: "نام", required: true, defaultValue: name },
              { name: "sortOrder", label: "ترتیب", type: "number", defaultValue: sortOrder },
              { name: "description", label: "توضیح", type: "textarea", defaultValue: description },
            ]} />
          </div>
        </div>
      )}
    </>
  );
}
