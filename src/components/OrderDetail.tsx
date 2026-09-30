import { RequestReturnButton } from "./CommerceClient";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { auditLogs, orderHistory, orderItems, orders, payments, sellers, sellerShipments, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { ORDER_STATUS, SHIPMENT_STATUS, jdate, toman, faNum } from "@/lib/util";
import { Card, KV, PageHeader, StatusBadge } from "./ui";
import { ActionButton } from "./client";
import { ShipmentActions } from "./ShipmentActions";
import { GatewayPayButton } from "./GatewayPayButton";
import { IssuePanel } from "./IssuePanel";
import { warehouseIssues } from "@/db/schema";
import { desc as descOrder } from "drizzle-orm";
import { AdminRecordPayment, ManualPaymentForm } from "./PaymentPanels";
import { PaymentDetails } from "./PaymentDetails";
import { PaymentInfoBox } from "./PaymentInfoBox";
import { getSettings } from "@/lib/settings";
import { ShipmentTimeline, carrierMap } from "./ShipmentTimeline";
import { activeCarriers } from "@/lib/marketing";

export async function OrderDetail({ id, user, view }: { id: number; user: SessionUser; view: "admin" | "customer" | "seller" }) {
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o) notFound();
  if (view === "customer" && o.customerId !== user.id) notFound();
  let shipments = await db.select({ sh: sellerShipments, s: sellers }).from(sellerShipments).leftJoin(sellers, eq(sellers.id, sellerShipments.sellerId)).where(eq(sellerShipments.orderId, id));
  let items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  if (view === "seller") {
    shipments = shipments.filter((x) => x.sh.sellerId === user.sellerId);
    if (!shipments.length) notFound();
    items = items.filter((i) => i.sellerId === user.sellerId);
  }
  const [customer] = await db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, o.customerId));
  const history = await db.select().from(orderHistory).where(eq(orderHistory.orderId, id)).orderBy(orderHistory.createdAt);
  const pays = view === "seller" ? [] : await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(payments.id);
  const settingsNow = await getSettings();
  const hideSellers = view === "customer" && !settingsNow.multiVendor;
  const pendingVerify = pays.some((p) => p.status === "pending_verification");
  const trail = view === "admin" && user.permissions.includes("AUDIT_LOG_VIEW")
    ? await db.select().from(auditLogs).where(or(and(eq(auditLogs.entity, "order"), eq(auditLogs.entityId, String(id))), and(eq(auditLogs.entity, "shipment"), inArray(auditLogs.entityId, shipments.map((s) => String(s.sh.id)).concat("0"))))).orderBy(desc(auditLogs.createdAt)).limit(50)
    : [];
  const cmap = await carrierMap(shipments.map((x) => x.sh));
  const issues = view === "customer" ? [] : await db.select().from(warehouseIssues).where(eq(warehouseIssues.orderId, o.id)).orderBy(descOrder(warehouseIssues.id));
  const issueFor = (shId: number) => { const i = issues.find((x) => x.shipmentId === shId && x.status !== "cancelled") ?? issues.find((x) => x.shipmentId === shId); return i ? { id: i.id, number: i.number, status: i.status, receiverName: i.receiverName, handedOverAt: i.handedOverAt?.toISOString() ?? null } : null; };
  const canIssueStaff = view === "admin" && (user.permissions.includes("INVENTORY_MANAGE") || user.permissions.includes("SHIPMENTS_MANAGE"));
  const carrierList = (await activeCarriers()).map((c) => ({ id: c.id, name: c.name }));
  const allShipped = shipments.filter((s) => s.sh.status !== "cancelled").every((s) => ["shipped", "delivered"].includes(s.sh.status));
  const canManageShip = view === "admin" && user.permissions.includes("SHIPMENTS_MANAGE");
  return (
    <div className="space-y-6">
      <PageHeader title={`سفارش ${o.number}`} subtitle={`ثبت: ${jdate(o.createdAt, true)}`} actions={<>
        <StatusBadge status={o.status} map={ORDER_STATUS} /><StatusBadge status={o.paymentStatus} map={{ paid: "پرداخت‌شده", unpaid: "پرداخت‌نشده", refunded: "مسترد", pending_verification: "در انتظار تأیید فیش" }} />
        <a href={`/print/order/${o.id}`} target="_blank" className="btn-ghost">🖨️ پرینت سفارش</a>
        {view !== "customer" && <a href={`/print/order-labels/${o.id}`} target="_blank" className="btn-ghost">🏷️ لیبل‌های پستی</a>}
        {view === "customer" && o.status === "pending_payment" && !pendingVerify && <><GatewayPayButton url={`/api/orders/${o.id}/gateway`} amount={o.total} /><ManualPaymentForm orderId={o.id} amount={o.total} bankInfo={settingsNow.bankAccountInfo} /></>}
        {view === "customer" && ["pending_payment", "paid"].includes(o.status) && <ActionButton url={`/api/orders/${o.id}/cancel`} className="btn-ghost" confirm="سفارش لغو و رزرو آزاد شود؟" prompt="دلیل لغو:" promptKey="reason">لغو سفارش</ActionButton>}
        {view === "customer" && ["paid", "processing", "shipped"].includes(o.status) && allShipped && <ActionButton url={`/api/orders/${o.id}/confirm`} className="btn-success" confirm="دریافت کامل سفارش را تأیید می‌کنید؟">تأیید دریافت سفارش</ActionButton>}
        {view === "admin" && user.permissions.includes("ORDERS_MANAGE") && ["pending_payment", "paid"].includes(o.status) && <ActionButton url={`/api/admin/orders/${o.id}/cancel`} className="btn-danger" confirm="لغو سفارش؟" prompt="دلیل:" promptKey="reason">لغو سفارش</ActionButton>}
        {view === "admin" && user.permissions.includes("PAYMENTS_MANAGE") && o.status === "pending_payment" && <AdminRecordPayment orderId={o.id} amount={o.total} />}
      </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {shipments.map(({ sh, s }) => {
            const its = items.filter((i) => i.shipmentId === sh.id);
            return (
              <Card key={sh.id} title={<span className="flex items-center gap-2">مرسوله #{faNum(sh.id)} — {hideSellers ? settingsNow.siteName : s?.shopName ?? "انبار مرکزی سبزینه"} <StatusBadge status={sh.status} map={SHIPMENT_STATUS} /></span>}
                action={view === "seller" ? <ShipmentActions id={sh.id} status={sh.status} base="/api/seller/shipments" carriers={carrierList} defaultCarrierId={sh.carrierId} /> : canManageShip ? <ShipmentActions id={sh.id} status={sh.status} base="/api/admin/shipments" allowDeliver carriers={carrierList} defaultCarrierId={sh.carrierId} /> : null}>
                {view !== "customer" && o.paymentStatus === "paid" && <div className="mb-3"><IssuePanel shipmentId={sh.id} packageCount={sh.packageCount} issue={issueFor(sh.id)} canIssue={view === "seller" ? true : canIssueStaff && sh.sellerId === null} /></div>}
                <div className="mb-4"><ShipmentTimeline sh={sh} trackingUrl={sh.carrierId ? cmap.get(sh.carrierId)?.trackingUrl : null} /></div>
                <table className="w-full text-sm"><tbody className="divide-y">
                  {its.map((i) => <tr key={i.id}><td className="py-2">{i.title}</td><td className="py-2 text-slate-500">{toman(i.unitPrice)} × {faNum(i.qty)}</td><td className="py-2 text-left font-bold">{toman(i.lineTotal)}</td></tr>)}
                </tbody></table>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(o.paymentStatus === "paid" || view === "admin") && sh.status !== "cancelled" && <a href={`/print/invoice/${sh.id}`} target="_blank" className="btn-sm">🧾 {sh.sellerId ? "فاکتور نیابتی" : "فاکتور فروش"}</a>}
                  {view !== "customer" && sh.status !== "cancelled" && <a href={`/print/label/${sh.id}`} target="_blank" className="btn-sm">🏷️ چاپ لیبل پستی</a>}
                </div>
                <div className="mt-3 grid gap-x-6 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
                  <KV k="هزینه ارسال" v={toman(sh.shippingCost)} /><KV k="تعداد بسته" v={faNum(sh.packageCount)} />
                  <KV k="شرکت حمل" v={sh.carrier ?? "—"} /><KV k="کد رهگیری" v={<span dir="ltr">{sh.trackingNumber ?? "—"}</span>} />
                  <KV k="زمان آماده‌سازی" v={`${faNum(sh.prepDays)} روز`} /><KV k="ارسال" v={jdate(sh.shippedAt, true)} />
                  <KV k="تحویل" v={jdate(sh.deliveredAt, true)} />
                  {view !== "customer" && sh.sellerId && <KV k="کمیسیون / تسویه" v={`${toman(sh.commission)} · ${sh.settled ? "آزادشده" : "در انتظار"}`} />}
                </div>
              </Card>
            );
          })}
          <Card title="تاریخچه وضعیت">
            <ol className="relative space-y-3 border-r-2 border-slate-200 pr-4">
              {history.map((h) => <li key={h.id} className="text-sm"><span className="absolute -right-[7px] mt-1.5 h-3 w-3 rounded-full bg-emerald-500" /><b>{ORDER_STATUS[h.status] ?? SHIPMENT_STATUS[h.status.replace("shipment:", "")] ?? h.status}</b> <span className="text-xs text-slate-400">{jdate(h.createdAt, true)}</span><div className="text-xs text-slate-500">{h.note}</div></li>)}
            </ol>
          </Card>
          {trail.length > 0 && <Card title="Audit Trail"><ul className="space-y-1 text-xs">{trail.map((a) => <li key={a.id} className="flex justify-between gap-2 rounded bg-slate-50 px-2 py-1"><span dir="ltr">{a.action}</span><span className="truncate text-slate-500" dir="ltr">{JSON.stringify(a.newValue)?.slice(0, 80)}</span><span className="text-slate-400">{jdate(a.createdAt, true)}</span></li>)}</ul></Card>}
        </div>
        <div className="space-y-6">
          {view !== "seller" ? (
            <Card title="فاکتور">
              <KV k="جمع اقلام" v={toman(o.itemsSubtotal)} /><KV k="ارسال فروشندگان" v={toman(o.sellerShippingTotal)} /><KV k="ارسال انبار مرکزی" v={toman(o.centralShipping)} />
              <KV k="مالیات" v={toman(o.tax)} />
              {o.festivalDiscount > 0 && <KV k="تخفیف جشنواره" v={`- ${toman(o.festivalDiscount)}`} />}
              {o.codeDiscount > 0 && <KV k={`کد تخفیف ${o.discountCode ?? ""}`} v={`- ${toman(o.codeDiscount)}`} />}
              <div className="mt-2 flex justify-between border-t pt-2 font-extrabold"><span>مبلغ کل</span><span className="text-emerald-700">{toman(o.total)}</span></div>
              {view === "customer" && <div className="mt-3"><PaymentInfoBox pays={pays} compact /></div>}
            </Card>
          ) : (
            <Card title="خلاصه سهم شما">{shipments.map(({ sh }) => <div key={sh.id}><KV k="مبلغ اقلام" v={toman(sh.itemsTotal)} /><KV k="هزینه ارسال" v={toman(sh.shippingCost)} /><KV k="کمیسیون" v={toman(sh.commission)} /></div>)}</Card>
          )}
          {view === "admin" && <Card title="جزئیات پرداخت‌ها">{pendingVerify && <div className="mb-3 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-800">فیش پرداخت در انتظار تأیید است.</div>}<PaymentDetails pays={pays} orderId={o.id} canManage={user.permissions.includes("PAYMENTS_MANAGE")} /></Card>}
          {view === "customer" && pendingVerify && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">فیش پرداخت شما ثبت شده و در انتظار تأیید واحد مالی است.</div>}
          <Card title="مشتری و آدرس تحویل">
            <KV k="مشتری" v={customer?.name} />
            <KV k="تحویل‌گیرنده" v={o.address.fullName} /><KV k="تلفن" v={view === "seller" ? o.address.phone.replace(/(\d{4})\d{4}(\d{3})/, "$1****$2") : o.address.phone} />
            <KV k="شهر" v={o.address.city} /><p className="mt-2 text-sm text-slate-600">{o.address.address}</p><KV k="کد پستی" v={o.address.postalCode || "—"} />
          </Card>
          {view==="customer"&&o.paymentStatus==="paid"&&["shipped","completed"].includes(o.status)&&<RequestReturnButton orderId={o.id}/>}
          <Link href={view === "admin" ? "/admin/orders" : view === "seller" ? "/seller/orders" : "/customer"} className="btn-ghost w-full">بازگشت به فهرست</Link>
        </div>
      </div>
    </div>
  );
}
