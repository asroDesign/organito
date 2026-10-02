"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "./client";
import { InventoryPartyForm } from "./InventoryPartyForm";

type PartyOption = { id: number; name: string };
export function InventoryReceiptForm({ productId, variantId, unit, parties }: { productId: number; variantId: number | null; unit: string; parties: PartyOption[] }) {
  const router = useRouter();
  const [type, setType] = useState<"purchase" | "consignment" | "adjust">("purchase");
  const [busy, setBusy] = useState(false);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [values, setValues] = useState({ qty: "", unitCost: "", freight: "0", customs: "0", partyId: "", invoiceNumber: "", paymentLocation: "", paymentTrackingNumber: "", paidAmount: "0", note: "" });
  const isReceipt = type !== "adjust";
  const patch = (key: keyof typeof values, value: string) => setValues((old) => ({ ...old, [key]: value }));
  return <>
  <form className="grid grid-cols-2 gap-3" onSubmit={async (event) => {
    event.preventDefault();
    const qty = Number(values.qty);
    if (!Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 100000 || (isReceipt && qty < 1)) { toast("مقدار باید عدد صحیح معتبر باشد", false); return; }
    if (isReceipt && !values.partyId) { toast("تولیدکننده / صاحب کالا را انتخاب کنید", false); return; }
    if (type === "purchase" && !values.invoiceNumber.trim()) { toast("شماره فاکتور خرید را وارد کنید", false); return; }
    setBusy(true);
    try {
      await api(`/api/admin/inventory/${productId}`, "POST", {
        variantId, qty, unitCost: Number(values.unitCost || 0), freight: Number(values.freight || 0), customs: Number(values.customs || 0), note: values.note,
        ...(isReceipt ? { receiptType: type, partyId: Number(values.partyId), invoiceNumber: values.invoiceNumber, paymentLocation: values.paymentLocation, paymentTrackingNumber: values.paymentTrackingNumber, paidAmount: Number(values.paidAmount || 0) } : {}),
      });
      toast(type === "consignment" ? "رسید امانی ثبت شد" : type === "purchase" ? "فاکتور خرید و رسید انبار ثبت شد" : "تعدیل موجودی ثبت شد");
      setValues((old) => ({ ...old, qty: "", invoiceNumber: "", paymentTrackingNumber: "", paidAmount: "0", note: "" }));
      router.refresh();
    } catch (error) { toast((error as Error).message, false); }
    finally { setBusy(false); }
  }}>
    <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="text-slate-600">نوع عملیات</span><select className="input" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="purchase">خرید و رسید فاکتوردار</option><option value="consignment">دریافت امانی از تولیدکننده</option><option value="adjust">تعدیل ورود / خروج</option></select></label>
    {isReceipt && <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="flex items-center justify-between gap-2"><span className="text-slate-600">تولیدکننده / صاحب کالا *</span><button type="button" className="btn-ghost whitespace-nowrap px-2 py-1 text-xs" onClick={() => setPartyModalOpen(true)}>+ ثبت تولیدکننده</button></span><select className="input" required value={values.partyId} onChange={(event) => patch("partyId", event.target.value)}><option value="">انتخاب کنید</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>}
    <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="text-slate-600">{isReceipt ? `مقدار ورود (${unit})` : `مقدار تعدیل (${unit}؛ منفی برای خروج)`}</span><input className="input" type="number" step="1" required value={values.qty} onChange={(event) => patch("qty", event.target.value)} placeholder={isReceipt ? `مثلاً ۱۲ ${unit}` : `مثلاً ۵ برای ورود یا ۳- برای خروج`} /></label>
    {type !== "consignment" && <label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">بهای خرید هر واحد</span><input className="input" type="number" min="0" step="1" value={values.unitCost} onChange={(event) => patch("unitCost", event.target.value)} /></label>}
    {type === "purchase" && <><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">شماره فاکتور *</span><input className="input" required value={values.invoiceNumber} onChange={(event) => patch("invoiceNumber", event.target.value)} /></label><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">هزینه حمل</span><input className="input" type="number" min="0" step="1" value={values.freight} onChange={(event) => patch("freight", event.target.value)} /></label><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">هزینه گمرک / جانبی</span><input className="input" type="number" min="0" step="1" value={values.customs} onChange={(event) => patch("customs", event.target.value)} /></label><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">پرداخت اولیه از فاکتور</span><input className="input" type="number" min="0" step="1" value={values.paidAmount} onChange={(event) => patch("paidAmount", event.target.value)} /></label><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">محل پرداخت</span><input className="input" value={values.paymentLocation} onChange={(event) => patch("paymentLocation", event.target.value)} placeholder="مثلاً بانک ملت / صندوق" /></label><label className="col-span-2 flex flex-col gap-1 text-sm"><span className="text-slate-600">شماره پیگیری رسید پرداخت</span><input className="input" value={values.paymentTrackingNumber} onChange={(event) => patch("paymentTrackingNumber", event.target.value)} /></label></>}
    {type === "consignment" && <><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">بهای توافقی هر واحد برای تسویه</span><input className="input" type="number" min="0" step="1" required value={values.unitCost} onChange={(event) => patch("unitCost", event.target.value)} /></label><label className="flex flex-col gap-1 text-sm"><span className="text-slate-600">شماره رسید / قرارداد امانی</span><input className="input" value={values.invoiceNumber} onChange={(event) => patch("invoiceNumber", event.target.value)} /></label><p className="col-span-2 rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-900">کالای امانی در موجودی انبار ثبت می‌شود، اما تا زمان فروش به موجودی متعلق به فروشگاه و بدهی خرید تبدیل نمی‌شود. فروش آن به حساب تفصیلی صاحب کالا منظور می‌شود.</p></>}
    <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="text-slate-600">توضیحات / شماره رسید</span><input className="input" value={values.note} onChange={(event) => patch("note", event.target.value)} /></label>
    <div className="col-span-2"><button disabled={busy || (isReceipt && !parties.length)} className="btn-primary w-full">{busy ? "در حال ثبت…" : type === "purchase" ? "ثبت فاکتور خرید و ورود انبار" : type === "consignment" ? "ثبت دریافت امانی" : "ثبت تعدیل موجودی"}</button></div>
  </form>
  {partyModalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPartyModalOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="inventory-party-modal-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="inventory-party-modal-title" className="text-lg font-extrabold">ثبت تولیدکننده / صاحب کالا</h2><button type="button" className="btn-ghost px-3" aria-label="بستن" onClick={() => setPartyModalOpen(false)}>×</button></div><p className="mb-4 text-sm leading-6 text-slate-600">این طرف حساب مستقل از فروشندگان مارکت‌پلیس ثبت می‌شود و برای رسید خرید یا کالای امانی قابل انتخاب خواهد بود.</p><InventoryPartyForm onCreated={(id) => { patch("partyId", String(id)); setPartyModalOpen(false); }} /></section></div>}
  </>;
}
