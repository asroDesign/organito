import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { centralPosItems, centralPosSales } from "@/db/schema";
import { LabelView, type LabelData } from "@/components/LabelView";
import { PrintButton } from "@/components/PrintButton";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { faNum, jdate, toman } from "@/lib/util";

export const metadata = { title: "لیبل پستی فروش حضوری" };

export default async function CentralPosLabel({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage({ role: "staff" });
  if (!user.permissions.includes("INVENTORY_MANAGE") && !user.permissions.includes("ORDERS_VIEW")) notFound();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const [sale] = await db.select().from(centralPosSales).where(eq(centralPosSales.id, id)).limit(1);
  if (!sale?.shippingAddress || !sale.shippingCity || !sale.shippingPostalCode) notFound();
  const [settings, items] = await Promise.all([
    getSettings(),
    db.select().from(centralPosItems).where(eq(centralPosItems.saleId, id)),
  ]);
  const data: LabelData = {
    receiver: sale.customerName,
    phone: sale.customerPhone,
    city: sale.shippingCity,
    address: sale.shippingAddress,
    postalCode: sale.shippingPostalCode,
    order: sale.number,
    shipment: "فروش حضوری",
    carrier: sale.shippingCarrierName ?? "—",
    tracking: "—",
    packages: "۱",
    sender: settings.senderName,
    senderAddress: `${settings.senderCity ?? ""} ${settings.senderAddress}`.trim(),
    senderPhone: settings.senderPhone ?? "",
    senderPostalCode: settings.senderPostalCode ?? "",
    date: jdate(sale.createdAt),
    total: toman(sale.total),
    payment: "پرداخت‌شده در محل",
    barcode: /^[A-Za-z0-9\-. ]+$/.test(sale.number) ? sale.number : `POS-${sale.id}`,
  };
  return <main><div className="no-print mx-auto mb-4 flex max-w-md justify-between px-2"><Link href={`/admin/pos/invoice/${sale.id}`} className="btn-ghost">بازگشت به فاکتور</Link><PrintButton label="چاپ لیبل" /></div><LabelView cfg={settings} data={data} items={items.map((item) => `${item.title} × ${faNum(item.quantity)}`)} /><style>{`@page { size: ${settings.labelWidth}mm ${settings.labelHeight}mm; margin: 0; }`}</style></main>;
}
