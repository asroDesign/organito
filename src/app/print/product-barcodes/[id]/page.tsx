import { eq, and, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { products, productVariants, sellerOffers } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Barcode } from "@/components/LabelView";
import { PrintButton } from "@/components/PrintButton";
import Link from "next/link";

export const metadata = { title: "چاپ بارکد تنوع‌ها" };
export default async function ProductBarcodePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p || p.status === "deleted") notFound();
  if (u.staff) { if (!u.permissions.includes("PRODUCTS_VIEW")) notFound(); }
  else if (!u.sellerId || (u.sellerId !== p.ownerSellerId && !(await db.select({ id: sellerOffers.id }).from(sellerOffers).where(and(eq(sellerOffers.productId, id), eq(sellerOffers.sellerId, u.sellerId))).limit(1)).length)) notFound();
  const [variants, s] = await Promise.all([
    db.select().from(productVariants).where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true), isNull(productVariants.deletedAt))).orderBy(productVariants.id),
    getSettings(),
  ]);
  if (!variants.length) notFound();
  return <main className="min-h-screen bg-slate-100 p-5 text-black print:bg-white print:p-0">
    <div className="no-print mx-auto mb-4 flex max-w-3xl justify-between"><Link href={u.staff ? `/admin/products/${id}` : "/seller/products"} className="btn-ghost">بازگشت</Link><PrintButton label="چاپ برچسب بارکد" /></div>
    <div className="barcode-labels mx-auto grid justify-center gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, ${s.barcodeLabelWidth}mm)` }}>
      {variants.map((v) => <article key={v.id} className="barcode-label flex break-inside-avoid flex-col items-center justify-center overflow-hidden bg-white p-2 text-center" style={{ width: `${s.barcodeLabelWidth}mm`, height: `${s.barcodeLabelHeight}mm`, fontSize: `${s.barcodeFontSize}px`, border: "1px solid #ddd", pageBreakAfter: "always" }}>
        {!!s.barcodeShowProductName && <b className="line-clamp-2 w-full">{p.nameFa}</b>}
        {variants.length > 1 && <div className="max-w-full truncate">{v.title}</div>}
        <div className="my-1 w-full max-w-full"><Barcode value={/^[A-Za-z0-9 .-]+$/.test(v.sku || p.sku) ? (v.sku || p.sku) : `ORG-${p.id}-${v.id}`} height={Math.max(22, s.barcodeLabelHeight * 1.1)} /></div>
        {!!s.barcodeShowSku && <span dir="ltr" className="font-mono">{v.sku || p.sku}</span>}
      </article>)}
    </div>
    <style>{`@media print { @page { size: ${s.barcodeLabelWidth}mm ${s.barcodeLabelHeight}mm; margin: 0; } .barcode-labels { display: block !important; } .barcode-label { width: ${s.barcodeLabelWidth}mm !important; height: ${s.barcodeLabelHeight}mm !important; margin: 0 !important; border: 0 !important; } }`}</style>
  </main>;
}
