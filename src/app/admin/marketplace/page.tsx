import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, sellerOffers, sellers, wallets, withdrawals } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client";
import Link2 from "next/link";
import { SellerTermsEditor } from "@/components/SellerTermsEditor";
import { KYC_STATUS } from "@/lib/services/kyc";
import { OFFER_STATUS, PRODUCT_STATUS, WITHDRAW_STATUS, faNum, jdate, maskIban, toman } from "@/lib/util";

export default async function Marketplace({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requirePage({ anyPerm: ["SUPPLIER_OFFERS_MANAGE", "SELLER_SETTLEMENT_MANAGE", "WITHDRAWALS_MANAGE"] });
  const tab = (await searchParams).tab ?? "sellers";
  const tabs: [string, string][] = [["sellers", "تأمین‌کنندگان"], ["products", "محصولات در انتظار"], ["offers", "پیشنهادهای قیمت"], ["withdrawals", "برداشت‌ها و تسویه"]];
  return (
    <>
      <PageHeader title="مرکز مدیریت مارکت‌پلیس" subtitle="پذیرش، قرارداد، کمیسیون، عملکرد، پیشنهادها، کیف پول و تسویه فروشندگان" />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">{tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${tab === k ? "bg-emerald-600 font-bold text-white" : "text-slate-600"}`}>{l}</Link>)}</div>
      {tab === "sellers" && <SellersTab canEdit={u.permissions.includes("SELLER_SETTLEMENT_MANAGE")} />}
      {tab === "products" && <PendingProducts />}
      {tab === "offers" && <OffersTab />}
      {tab === "withdrawals" && <WithdrawalsTab canManage={u.permissions.includes("WITHDRAWALS_MANAGE")} />}
    </>
  );
}

async function SellersTab({ canEdit }: { canEdit: boolean }) {
  const rows = await db.execute(sql`
    select s.*, (select count(*) from seller_documents d where d.seller_id = s.id and d.status = 'pending')::int as docs_pending, (select count(*) from seller_documents d where d.seller_id = s.id and d.status in ('requested','rejected'))::int as docs_open, w.pending_balance, w.available_balance, w.locked_balance, w.withdrawn_balance,
      (select count(*) from products p where p.owner_seller_id = s.id and p.status <> 'deleted')::int as product_count,
      (select count(*) from seller_offers o where o.seller_id = s.id)::int as offer_count,
      (select coalesce(sum(sh.items_total),0) from seller_shipments sh join orders o on o.id = sh.order_id where sh.seller_id = s.id and o.payment_status = 'paid')::bigint as sales,
      (select count(*) from seller_shipments sh where sh.seller_id = s.id)::int as ship_total,
      (select count(*) from seller_shipments sh where sh.seller_id = s.id and sh.status = 'returned')::int as returns,
      (select count(*) from seller_shipments sh where sh.seller_id = s.id and sh.shipped_at > sh.created_at + (sh.prep_days + 1) * interval '1 day')::int as late
    from sellers s left join wallets w on w.seller_id = s.id order by s.id`);
  type R = { id: number; shop_name: string; city: string; status: string; contract_status: string; commission_rate: number; settlement_days: number; rating: number; legal_docs: string | null; kyc_status: string; restricted: boolean; restrict_reason: string | null; entity_type: string; docs_pending: number; docs_open: number; pending_balance: string; available_balance: string; withdrawn_balance: string; product_count: number; offer_count: number; sales: string; ship_total: number; returns: number; late: number };
  const list = rows.rows as R[];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((s) => (
        <Card key={s.id} title={<span className="flex flex-wrap items-center gap-2">{s.shop_name}<StatusBadge status={s.status} map={{ pending: "در انتظار پذیرش", approved: "فعال", suspended: "تعلیق", rejected: "رد" }} /><span className={`rounded-full px-2 py-0.5 text-[11px] ${s.kyc_status === "verified" ? "bg-emerald-100 text-emerald-700" : s.kyc_status === "needs_info" ? "bg-amber-100 text-amber-700" : s.kyc_status === "submitted" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{KYC_STATUS[s.kyc_status]}</span>{s.restricted && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">⛔ محدود</span>}</span>}
          action={<Link2 href={`/admin/marketplace/sellers/${s.id}`} className="btn-sm">پرونده و مدارک{s.docs_pending > 0 && <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">{s.docs_pending.toLocaleString("fa-IR")}</span>}</Link2>}>
          <div className="grid grid-cols-2 gap-x-6 text-sm">
            <div className="flex justify-between py-1"><span className="text-slate-500">شهر</span>{s.city}</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">امتیاز</span>{s.rating}</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">محصولات / پیشنهادها</span>{faNum(s.product_count)} / {faNum(s.offer_count)}</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">فروش</span>{toman(Number(s.sales))}</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">تأخیر ارسال</span>{faNum(s.late)} از {faNum(s.ship_total)}</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">نرخ مرجوعی</span>{s.ship_total ? faNum(Math.round((s.returns / s.ship_total) * 100)) : "۰"}٪</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">در انتظار آزادسازی</span>{toman(Number(s.pending_balance))}</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">قابل برداشت</span>{toman(Number(s.available_balance))}</div>
            <div className="col-span-2 flex justify-between py-1"><span className="text-slate-500">نوع / مدارک</span><span>{s.entity_type === "legal" ? "حقوقی" : "حقیقی"} · {s.docs_pending.toLocaleString("fa-IR")} در انتظار بررسی · {s.docs_open.toLocaleString("fa-IR")} ناقص</span></div>
          </div>
          {canEdit && <div className="mt-3"><SellerTermsEditor compact id={s.id} status={s.status} contract={s.contract_status} rate={s.commission_rate} days={s.settlement_days} /></div>}
        </Card>
      ))}
    </div>
  );
}

async function PendingProducts() {
  const list = await db.select({ p: products, shop: sellers.shopName }).from(products).leftJoin(sellers, eq(sellers.id, products.ownerSellerId)).where(eq(products.status, "pending")).orderBy(desc(products.updatedAt));
  return (
    <Table head={["محصول", "فروشنده", "PN", "وضعیت", ""]} empty={!list.length}>
      {list.map(({ p, shop }) => <tr key={p.id}><Td><b>{p.nameFa}</b></Td><Td>{shop ?? "—"}</Td><Td><span dir="ltr">{p.partNumber}</span></Td><Td><StatusBadge status={p.status} map={PRODUCT_STATUS} /></Td>
        <Td><div className="flex gap-1"><Link href={`/admin/products/${p.id}`} className="btn-sm">بررسی</Link><ActionButton url={`/api/products/${p.id}/status`} data={{ status: "active" }} className="btn-success">تأیید</ActionButton><ActionButton url={`/api/products/${p.id}/status`} data={{ status: "rejected" }} prompt="دلیل رد:" promptKey="reason" className="btn-danger">رد</ActionButton></div></Td></tr>)}
    </Table>
  );
}

async function OffersTab() {
  const list = await db.select({ o: sellerOffers, s: sellers, p: products }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId)).innerJoin(products, eq(products.id, sellerOffers.productId))
    .orderBy(sql`case when ${sellerOffers.status} = 'pending' then 0 else 1 end`, desc(sellerOffers.updatedAt)).limit(200);
  return (
    <Table head={["محصول", "فروشنده", "قیمت", "موجودی آزاد", "ارسال", "وضعیت", ""]} empty={!list.length}>
      {list.map(({ o, s, p }) => <tr key={o.id}><Td><Link href={`/admin/products/${p.id}`} className="font-bold hover:text-emerald-700">{p.nameFa}</Link></Td><Td>{s.shopName}</Td><Td>{toman(o.salePrice ?? o.price)}</Td><Td>{faNum(o.stock - o.reserved)}</Td><Td>{toman(o.shippingCost)}</Td><Td><StatusBadge status={o.status} map={OFFER_STATUS} /></Td>
        <Td><div className="flex gap-1">{o.status !== "approved" && <ActionButton url={`/api/admin/offers/${o.id}/status`} data={{ status: "approved" }} className="btn-success">تأیید</ActionButton>}{o.status === "pending" && <ActionButton url={`/api/admin/offers/${o.id}/status`} data={{ status: "rejected" }} className="btn-danger">رد</ActionButton>}{o.status === "approved" && <ActionButton url={`/api/admin/offers/${o.id}/status`} data={{ status: "suspended" }} className="btn-sm">تعلیق</ActionButton>}</div></Td></tr>)}
    </Table>
  );
}

async function WithdrawalsTab({ canManage }: { canManage: boolean }) {
  const list = await db.select({ w: withdrawals, s: sellers, wal: wallets }).from(withdrawals).innerJoin(sellers, eq(sellers.id, withdrawals.sellerId)).leftJoin(wallets, eq(wallets.sellerId, sellers.id)).orderBy(desc(withdrawals.createdAt));
  return (
    <Table head={["فروشنده", "مبلغ", "شبا", "تاریخ", "وضعیت", "پیگیری", ""]} empty={!list.length}>
      {list.map(({ w, s }) => <tr key={w.id}><Td>{s.shopName}</Td><Td><b>{toman(w.amount)}</b></Td><Td><span dir="ltr">{maskIban(w.iban)}</span></Td><Td>{jdate(w.createdAt, true)}</Td><Td><StatusBadge status={w.status} map={WITHDRAW_STATUS} /></Td><Td>{w.trackingCode ?? "—"}</Td>
        <Td>{canManage && <div className="flex gap-1">
          {w.status === "pending" && <><ActionButton url={`/api/admin/withdrawals/${w.id}`} data={{ action: "approve" }} className="btn-success">تأیید</ActionButton><ActionButton url={`/api/admin/withdrawals/${w.id}`} data={{ action: "reject" }} prompt="دلیل رد:" className="btn-danger">رد</ActionButton></>}
          {w.status === "approved" && <ActionButton url={`/api/admin/withdrawals/${w.id}`} data={{ action: "process" }} className="btn-sm">در حال پرداخت</ActionButton>}
          {["approved", "processing"].includes(w.status) && <ActionButton url={`/api/admin/withdrawals/${w.id}`} data={{ action: "pay" }} prompt="شماره پیگیری بانکی:" promptKey="trackingCode" className="btn-success">ثبت پرداخت</ActionButton>}
        </div>}</Td></tr>)}
    </Table>
  );
}
