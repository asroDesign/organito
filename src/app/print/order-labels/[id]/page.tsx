import Link from "next/link";
import { labelData, loadOrderForPrint } from "@/lib/printAccess";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { LabelView } from "@/components/LabelView";
import { faNum } from "@/lib/util";

export const metadata = { title: "لیبل‌های پستی سفارش" };

export default async function OrderLabels({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { o, shs, items, sellers, staffOk, u } = await loadOrderForPrint(id, "labels");
  if (!staffOk && !u.sellerId) return null;
  const s = await getSettings();
  return (
    <div>
      <div className="no-print mx-auto mb-4 flex max-w-md justify-between px-2"><Link href={staffOk ? `/orders/${o.id}` : `/seller/orders/${o.id}`} className="btn-ghost">بازگشت</Link><PrintButton label={`چاپ ${faNum(shs.length)} لیبل`} /></div>
      <div className="space-y-6 print:space-y-0">
        {shs.map((sh) => <LabelView key={sh.id} cfg={s} data={labelData(s, o, sh, sellers.find((x) => x.id === sh.sellerId))} items={items.filter((i) => i.shipmentId === sh.id).map((i) => `${i.title} × ${faNum(i.qty)}`)} />)}
      </div>
      <style>{`@page { size: ${s.labelWidth}mm ${s.labelHeight}mm; margin: 0; }`}</style>
    </div>
  );
}
