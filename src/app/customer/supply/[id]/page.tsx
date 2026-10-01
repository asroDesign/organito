import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { supplyHistory, supplyRequests } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, KV, PageHeader, StatusBadge } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { GatewayPayButton } from "@/components/GatewayPayButton";
import { getSettings } from "@/lib/settings";
import { SUPPLY_STATUS, faNum, jdate, toman } from "@/lib/util";

export default async function CustomerSupplyDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage();
  const settings = await getSettings();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [r] = await db.select().from(supplyRequests).where(and(eq(supplyRequests.id, id), eq(supplyRequests.customerId, u.id)));
  if (!r) notFound();
  const hist = await db.select().from(supplyHistory).where(eq(supplyHistory.requestId, id)).orderBy(supplyHistory.createdAt);
  const sub = r.unitSalePrice * r.qty;
  return (
    <>
      <PageHeader title={`درخواست تأمین ${r.number}`} subtitle={jdate(r.createdAt, true)} actions={<>
        <StatusBadge status={r.status} map={SUPPLY_STATUS} />
        {r.status === "quotation_sent" && <ActionButton url={`/api/supply/${r.id}/customer`} data={{ action: "approve" }} className="btn-success">تأیید پیش‌فاکتور</ActionButton>}
        {r.status === "payment_pending" && <GatewayPayButton url={`/api/supply/${r.id}/gateway`} amount={r.quotationTotal} label={`پرداخت آنلاین با ${settings.paymentGateway === "zibal" ? "زیبال" : "زرین‌پال"}`} />}
        {["pending", "reviewing", "quotation_sent", "payment_pending", "supplier_search", "rfq_sent", "supplier_found", "price_calculated", "internal_match_found"].includes(r.status) && <ActionButton url={`/api/supply/${r.id}/customer`} data={{ action: "cancel" }} className="btn-ghost" confirm="لغو درخواست؟">لغو</ActionButton>}
      </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="مشخصات درخواست">
          <KV k="روش" v={r.method} /><KV k="کد محصول" v={<span dir="ltr">{r.partNumber || "—"}</span>} /><KV k="نام محصول" v={r.partName || "—"} />
          <KV k="محصول" v={`${r.carMake ?? ""} ${r.carModel ?? ""} ${r.carYear ?? ""}`} /><KV k="بارکد" v={<span dir="ltr">{r.vin ?? "—"}</span>} /><KV k="تعداد" v={faNum(r.qty)} />
          {r.mediaIds.length > 0 && <div className="mt-2 flex gap-2">{r.mediaIds.map((m) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={m} src={`/api/media/${m}`} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}
        </Card>
        <Card title="پیش‌فاکتور">
          {r.quotationTotal && ["quotation_sent", "customer_approved", "payment_pending", "paid", "purchasing", "received", "ready_to_ship", "shipped", "completed"].includes(r.status) ? <>
            <KV k="قیمت واحد" v={toman(r.unitSalePrice)} /><KV k="جمع" v={toman(sub)} /><KV k="ارسال" v={toman(r.shippingCost)} /><KV k="مالیات" v={toman(r.quotationTotal - sub - r.shippingCost)} />
            <div className="mt-2 flex justify-between border-t pt-2 font-extrabold"><span>مبلغ کل</span><span className="text-emerald-700">{toman(r.quotationTotal)}</span></div>
            {r.trackingNumber && <div className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs">ارسال با {r.carrier} — کد رهگیری <b dir="ltr">{r.trackingNumber}</b></div>}
          </> : <p className="text-sm text-slate-500">پیش‌فاکتور پس از بررسی کارشناس و دریافت پیشنهاد تأمین‌کنندگان صادر می‌شود.</p>}
        </Card>
        <Card title="روند پیگیری">
          <ol className="space-y-2 border-r-2 border-slate-200 pr-3 text-sm">{hist.map((h) => <li key={h.id}><b>{SUPPLY_STATUS[h.toStatus] ?? h.toStatus}</b> <span className="text-xs text-slate-400">{jdate(h.createdAt, true)}</span></li>)}{!hist.length && <li className="text-slate-500">ثبت‌شده، در صف بررسی</li>}</ol>
        </Card>
      </div>
    </>
  );
}
