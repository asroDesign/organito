"use client";
import { JsonForm } from "./client";

export function InventorySettlementForm({ partyId, balance }: { partyId: number; balance: number }) {
  return <JsonForm url={`/api/admin/inventory/parties/${partyId}/payments`} extra={{ partyId }} submit="ثبت تسویه و سند پرداخت" fields={[
    { name: "amount", label: `مبلغ پرداخت (مانده ${balance.toLocaleString("fa-IR")})`, type: "number", required: true, half: true },
    { name: "paymentLocation", label: "محل پرداخت / حساب بانکی", required: true, half: true },
    { name: "trackingNumber", label: "شماره پیگیری رسید پرداخت", half: true },
    { name: "note", label: "شرح تسویه", half: true },
  ]} />;
}
