import Link from "next/link";
import { labelData, loadShipmentForPrint } from "@/lib/printAccess";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { LabelView } from "@/components/LabelView";
import { faNum } from "@/lib/util";

export const metadata = { title: "لیبل پستی" };

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sh, o, items, seller, u } = await loadShipmentForPrint(id, "label");
  const s = await getSettings();
  const data = labelData(s, o, sh, seller);
  const back = u.staff ? `/orders/${o.id}` : `/seller/orders/${o.id}`;
  return (
    <div>
      <div className="no-print mx-auto mb-4 flex max-w-md justify-between px-2"><Link href={back} className="btn-ghost">بازگشت</Link><PrintButton label="چاپ لیبل" /></div>
      <LabelView cfg={s} data={data} items={items.map((i) => `${i.title} × ${faNum(i.qty)}`)} />
      <style>{`@page { size: ${s.labelWidth}mm ${s.labelHeight}mm; margin: 0; }`}</style>
    </div>
  );
}
