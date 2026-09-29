"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toast, ImageUploader } from "./client";

const METHODS: [string, string][] = [["part_number", "کد محصول / بارکد"], ["vehicle", "نام محصول + برند"], ["vin", "بارکد محصول"], ["image", "تصویر محصول/پلاک"]];

export function SupplyForm({ defaultPn }: { defaultPn: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("part_number");
  const [images, setImages] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      setBusy(true);
      try {
        const r = await api<{ id: number }>("/api/supply", "POST", { ...fd, method, mediaIds: images });
        toast("درخواست ثبت شد");
        router.push(`/customer/supply/${r.id}`);
      } catch (e2) { toast((e2 as Error).message, false); } finally { setBusy(false); }
    }}>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs">
        {METHODS.map(([k, l]) => <button type="button" key={k} onClick={() => setMethod(k)} className={`rounded-lg py-2 ${method === k ? "bg-white font-bold shadow" : ""}`}>{l}</button>)}
      </div>
      <input name="partNumber" defaultValue={defaultPn} placeholder="نام یا کد محصول" className="input" dir="ltr" required={method === "part_number"} />
      <input name="partName" placeholder="نام محصول (مثلاً: عسل آویشن)" className="input" required={method === "vehicle"} />
      <div className="grid grid-cols-3 gap-2"><input name="carMake" placeholder="برند / تولیدکننده" className="input" required={method === "vehicle"} /><input name="carModel" placeholder="نوع / بسته‌بندی" className="input" /><input name="carYear" placeholder="وزن / مقدار" className="input" /></div>
      {method === "vin" && <input name="vin" placeholder="بارکد (۸ تا ۱۴ رقم)" maxLength={14} className="input" dir="ltr" required />}
      <div className="grid grid-cols-2 gap-2">
        <input name="qty" type="number" min={1} defaultValue={1} className="input" />
        <select name="priority" className="input" defaultValue="normal"><option value="low">اولویت کم</option><option value="normal">عادی</option><option value="high">بالا</option><option value="urgent">فوری</option></select>
      </div>
      <textarea name="description" placeholder="توضیحات" className="input min-h-20" />
      <ImageUploader value={images} onChange={setImages} max={5} />
      <button disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}ثبت درخواست تأمین</button>
    </form>
  );
}
