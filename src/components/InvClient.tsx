"use client";
import { useState } from "react";
import { JsonForm } from "./client";

export function InvClient({ items }: { items: [string, string][] }) {
  const [pid, setPid] = useState(items[0]?.[0] ?? "");
  return (
    <div className="space-y-3">
      <select value={pid} onChange={(e) => setPid(e.target.value)} className="input">{items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      {pid && <JsonForm key={pid} url={`/api/admin/inventory/${pid}`} submit="ثبت" fields={[
        { name: "qty", label: "تعداد (+/-)", type: "number", required: true, half: true },
        { name: "unitCost", label: "قیمت خرید واحد", type: "number", half: true },
        { name: "freight", label: "هزینه حمل", type: "number", half: true, defaultValue: 0 },
        { name: "customs", label: "هزینه گمرک", type: "number", half: true, defaultValue: 0 },
        { name: "note", label: "توضیح" },
      ]} />}
    </div>
  );
}
