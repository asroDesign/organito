"use client";
import { JsonForm } from "./client";

type RepackVariant = { id: number; title: string; sku: string; inventoryUnit: string; baseUnitAmount: number; onHand: number; reserved: number };
export function InventoryRepackForm({ productId, productName, baseUnit, variants }: { productId: number; productName: string; baseUnit: string; variants: RepackVariant[] }) {
  const choices = variants.map((v) => [String(v.id), `${v.title} · ${v.onHand.toLocaleString("fa-IR")} ${v.inventoryUnit} · هر واحد ${v.baseUnitAmount.toLocaleString("fa-IR")} ${baseUnit}`] as [string, string]);
  if (variants.length < 2) return null;
  return <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
    <div className="mb-3"><h3 className="font-bold text-amber-950">بسته‌بندی / تبدیل موجودی</h3><p className="mt-1 text-xs leading-5 text-amber-900/80">برای {productName} یک تنوع را مصرف و تنوع بسته‌بندی‌شده را اضافه کنید. سیستم نسبت واحد پایه را کنترل می‌کند.</p></div>
    <JsonForm url="/api/admin/inventory/repack" extra={{ productId }} submit="ثبت تبدیل و گردش انبار" fields={[
      { name: "sourceVariantId", label: "از تنوع (مصرف شود)", type: "select", required: true, options: choices },
      { name: "targetVariantId", label: "به تنوع (تولید شود)", type: "select", required: true, options: choices },
      { name: "inputQty", label: "مقدار مصرف از تنوع مبدأ", type: "number", required: true, placeholder: "مقدار را بر اساس واحد تنوع مبدأ وارد کنید" },
      { name: "outputQty", label: "تعداد بسته تولیدشده", type: "number", required: true, placeholder: "تعداد ظرف یا بسته" },
      { name: "note", label: "توضیح / شماره بچ تولید", placeholder: "اختیاری" },
    ]} />
    <p className="mt-2 text-[11px] text-slate-500">مثال عسل: ۱۰ کیلوگرم فله را مصرف کنید و ۲۰ ظرف ۵۰۰ گرمی به موجودی اضافه کنید. مصرف معادل باید حداقل برابر مقدار تولید باشد.</p>
  </section>;
}
