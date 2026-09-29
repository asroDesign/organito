import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, sellers, supplyHistory, supplyQuotes, supplyRequests, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, KV, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { SupplyAdvance } from "@/components/SupplyAdvance";
import { SUPPLY_STATUS, faNum, jdate, toman } from "@/lib/util";
import { SUPPLY_FLOW } from "@/lib/services/supply";

export default async function AdminSupplyDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage({ perm: "SUPPLY_REQUESTS_VIEW" });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [r] = await db.select().from(supplyRequests).where(eq(supplyRequests.id, id));
  if (!r) notFound();
  const [cust] = await db.select().from(users).where(eq(users.id, r.customerId));
  const [match] = r.matchedProductId ? await db.select().from(products).where(eq(products.id, r.matchedProductId)) : [];
  const quotes = await db.select({ q: supplyQuotes, s: sellers }).from(supplyQuotes).innerJoin(sellers, eq(sellers.id, supplyQuotes.sellerId)).where(eq(supplyQuotes.requestId, id));
  const hist = await db.select({ h: supplyHistory, name: users.name }).from(supplyHistory).leftJoin(users, eq(users.id, supplyHistory.userId)).where(eq(supplyHistory.requestId, id)).orderBy(supplyHistory.createdAt);
  const can = u.permissions.includes("SUPPLY_REQUESTS_MANAGE");
  const next = SUPPLY_FLOW[r.status] ?? [];
  const A = (action: string, label: string, cls = "btn-sm", data: Record<string, unknown> = {}) => <ActionButton url={`/api/admin/supply/${id}`} data={{ action, ...data }} className={cls}>{label}</ActionButton>;
  const sub = r.unitSalePrice * r.qty;
  return (
    <>
      <PageHeader title={`درخواست ${r.number}`} subtitle={`${cust?.name} · ${jdate(r.createdAt, true)}`} actions={<StatusBadge status={r.status} map={SUPPLY_STATUS} />} />
      {can && (
        <Card title="اقدامات کارشناس" className="mb-6">
          <div className="flex flex-wrap gap-2">
            {r.status === "pending" && A("review", "۱. شروع بررسی", "btn-primary")}
            {r.status === "reviewing" && A("search", "۲-۳. جست‌وجوی کاتالوگ و نام‌های دیگر", "btn-primary")}
            {["supplier_search", "internal_match_found", "supplier_found"].includes(r.status) && A("rfq", "۴. ارسال RFQ به تأمین‌کنندگان", "btn-primary")}
            {next.includes("price_calculated") && <ActionButton url={`/api/admin/supply/${id}`} data={{ action: "calculate" }} prompt="درصد حاشیه سود:" promptKey="margin" className="btn-primary">۸. محاسبه قیمت فروش</ActionButton>}
            {r.status === "price_calculated" && A("send_quotation", "۹. صدور پیش‌فاکتور", "btn-success")}
            {next.includes("rejected") && <ActionButton url={`/api/admin/supply/${id}`} data={{ action: "reject" }} prompt="دلیل:" className="btn-danger">رد درخواست</ActionButton>}
            {r.assigneeId !== u.id && A("assign", "ارجاع به من", "btn-ghost", { assigneeId: u.id })}
            <SupplyAdvance id={id} options={next.filter((n) => ["purchasing", "received", "ready_to_ship", "shipped", "completed", "cancelled"].includes(n))} />
          </div>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="اطلاعات درخواست">
          <KV k="روش" v={r.method} /><KV k="کد محصول" v={<span dir="ltr">{r.partNumber || "—"}</span>} /><KV k="نرمال‌شده" v={<span dir="ltr">{r.normalizedPn || "—"}</span>} />
          <KV k="نام محصول" v={r.partName || "—"} /><KV k="محصول" v={`${r.carMake ?? ""} ${r.carModel ?? ""} ${r.carYear ?? ""}`} /><KV k="بارکد" v={<span dir="ltr">{r.vin ?? "—"}</span>} />
          <KV k="تعداد" v={faNum(r.qty)} /><KV k="اولویت" v={r.priority} /><p className="mt-2 text-sm text-slate-600">{r.description}</p>
          {r.mediaIds.length > 0 && <div className="mt-2 flex gap-2">{r.mediaIds.map((m) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={m} src={`/api/media/${m}`} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}
          {match && <div className="mt-3 rounded-xl bg-violet-50 p-3 text-sm">تطابق داخلی: <Link href={`/admin/products/${match.id}`} className="font-bold text-violet-700">{match.nameFa}</Link> — موجودی {faNum(match.onHand - match.reserved)}</div>}
        </Card>
        <Card title="پیش‌فاکتور">
          <KV k="حاشیه سود" v={`${faNum(r.marginPercent)}٪`} /><KV k="قیمت واحد فروش" v={toman(r.unitSalePrice)} /><KV k="جمع" v={toman(sub)} />
          <KV k="ارسال" v={toman(r.shippingCost)} /><KV k="مالیات" v={toman(r.quotationTotal ? r.quotationTotal - sub - r.shippingCost : 0)} />
          <div className="mt-2 flex justify-between border-t pt-2 font-extrabold"><span>جمع کل</span><span>{toman(r.quotationTotal)}</span></div>
          {r.trackingNumber && <KV k="رهگیری" v={`${r.carrier} ${r.trackingNumber}`} />}
        </Card>
        <Card title="تاریخچه وضعیت">
          <ol className="space-y-2 text-sm">{hist.map(({ h, name }) => <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2"><b>{SUPPLY_STATUS[h.toStatus]}</b><div className="text-xs text-slate-500">{h.note} · {name} · {jdate(h.createdAt, true)}</div></li>)}</ol>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">۵-۷. مقایسه پیشنهادهای تأمین‌کنندگان (RFQ)</h2>
      <Table head={["تأمین‌کننده", "قیمت", "موجودی", "Lead Time", "برند", "توضیح", "وضعیت", ""]} empty={!quotes.length}>
        {quotes.sort((a, b) => (a.q.price || 1e15) - (b.q.price || 1e15)).map(({ q, s }) => <tr key={q.id} className={q.id === r.selectedQuoteId ? "bg-emerald-50" : ""}><Td>{s.shopName}</Td><Td>{q.price ? toman(q.price) : "—"}</Td><Td>{faNum(q.stock)}</Td><Td>{faNum(q.leadDays)} روز</Td><Td>{q.brand ?? "—"}</Td><Td>{q.note ?? "—"}</Td>
          <Td><StatusBadge status={q.status} map={{ requested: "درخواست‌شده", quoted: "پاسخ داده", selected: "انتخاب‌شده", rejected: "رد" }} /></Td>
          <Td>{can && q.status === "quoted" && ["supplier_found", "price_calculated", "quotation_sent"].includes(r.status) && A("select_quote", "انتخاب", "btn-success", { quoteId: q.id })}</Td></tr>)}
      </Table>
    </>
  );
}
