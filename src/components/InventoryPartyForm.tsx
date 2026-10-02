"use client";
import { JsonForm } from "./client";

export function InventoryPartyForm({ onCreated }: { onCreated?: (id: number) => void }) {
  return <JsonForm url="/api/admin/inventory/parties" submit="ثبت تولیدکننده / صاحب کالا" onDone={(row) => onCreated?.(Number(row.id))} fields={[
    { name: "name", label: "نام شخص یا تولیدکننده", required: true, placeholder: "نام حقیقی یا حقوقی" },
    { name: "phone", label: "شماره تماس", half: true },
    { name: "nationalId", label: "کد ملی / شناسه ملی", half: true },
    { name: "address", label: "نشانی", half: true },
  ]} />;
}
