import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, categories, productImages, products, productVariants, sellerOffers, sellers, stockMovements } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Badge, Card, Img, KV, PageHeader, StatusBadge, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { AUTH_LABEL, OFFER_STATUS, PRODUCT_STATUS, faNum, jdate, toman } from "@/lib/util";

export default async function AdminProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage({ perm: "PRODUCTS_VIEW" });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db.select({ p: products, cat: categories.name, shop: sellers.shopName }).from(products).leftJoin(categories, eq(categories.id, products.categoryId)).leftJoin(sellers, eq(sellers.id, products.ownerSellerId)).where(eq(products.id, id));
  if (!row) notFound();
  const p = row.p;
  const [imgs, vars, offers, moves, logs] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.sortOrder),
    db.select().from(productVariants).where(eq(productVariants.productId, id)),
    db.select({ o: sellerOffers, s: sellers }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId)).where(eq(sellerOffers.productId, id)),
    db.select().from(stockMovements).where(eq(stockMovements.productId, id)).orderBy(desc(stockMovements.createdAt)).limit(15),
    db.select().from(auditLogs).where(and(eq(auditLogs.entity, "product"), eq(auditLogs.entityId, String(id)))).orderBy(desc(auditLogs.createdAt)).limit(15),
  ]);
  const canApprove = u.permissions.includes("PRODUCTS_APPROVE");
  const canDisable = u.permissions.includes("PRODUCTS_DISABLE");
  const canOffers = u.permissions.includes("SUPPLIER_OFFERS_MANAGE");
  const st = (s: string, label: string, cls = "btn-sm", extra: Record<string, unknown> = {}) => <ActionButton url={`/api/products/${id}/status`} data={{ status: s, ...extra }} className={cls}>{label}</ActionButton>;
  return (
    <>
      <PageHeader title={p.nameFa} subtitle={`${p.sku} · ${row.cat ?? ""}`} actions={<>
        <StatusBadge status={p.status} map={PRODUCT_STATUS} />
        {canApprove && ["pending", "draft", "approved", "inactive", "rejected", "suspended", "out_of_stock"].includes(p.status) && st("active", "تأیید و فعال‌سازی", "btn-success")}
        {canApprove && p.status === "pending" && <ActionButton url={`/api/products/${id}/status`} data={{ status: "rejected" }} prompt="دلیل رد:" promptKey="reason" className="btn-danger">رد محصول</ActionButton>}
        {canDisable && p.status === "active" && <>{st("inactive", "غیرفعال")}{st("out_of_stock", "اعلام ناموجودی")}{st("suspended", "تعلیق")}</>}
        {canDisable && p.status !== "deleted" && <ActionButton url={`/api/products/${id}/status`} data={{ status: "deleted" }} confirm="حذف نرم محصول؟" className="btn-sm" redirect="/admin/products">حذف</ActionButton>}
        {u.permissions.includes("PRODUCTS_EDIT") && <Link href={`/admin/products/${id}/edit`} className="btn-primary">ویرایش</Link>}
        {p.status === "active" && <Link href={`/products/${p.slug}`} className="btn-ghost">مشاهده در فروشگاه</Link>}
      </>} />
      {p.rejectReason && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">دلیل رد: {p.rejectReason}</div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="تصاویر و فایل‌ها">
          <div className="grid grid-cols-3 gap-2">{imgs.map((i, k) => <div key={i.id} className="relative"><Img id={i.mediaId} alt="" className="aspect-square w-full rounded-xl" />{k === 0 && <span className="absolute bottom-1 right-1"><Badge tone="blue">اصلی</Badge></span>}</div>)}</div>
          {!imgs.length && <p className="text-sm text-slate-500">تصویری ثبت نشده. از صفحه ویرایش آپلود کنید.</p>}
        </Card>
        <Card title="اطلاعات محصول" className="lg:col-span-2">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <KV k="نام انگلیسی" v={p.nameEn ?? "—"} /><KV k="کد محصول" v={<span dir="ltr">{p.partNumber}</span>} /><KV k="OEM" v={<span dir="ltr">{p.oemNumber ?? "—"}</span>} />
            <KV k="برند / سازنده" v={`${p.brand} / ${p.manufacturer ?? "—"}`} /><KV k="کشور" v={p.country ?? "—"} /><KV k="اصالت" v={AUTH_LABEL[p.authenticity]} />
            <KV k="قیمت پایه" v={toman(p.basePrice)} /><KV k="قبل از تخفیف" v={toman(p.compareAtPrice)} /><KV k="منبع" v={p.source === "central" ? "انبار مرکزی" : `Marketplace — ${row.shop ?? ""}`} />
            <KV k="موجودی / رزرو" v={`${faNum(p.onHand)} / ${faNum(p.reserved)}`} /><KV k="میانگین موزون خرید" v={toman(p.avgCost)} /><KV k="ارزش موجودی" v={toman(p.avgCost * p.onHand)} />
            <KV k="حد هشدار" v={faNum(p.lowStockThreshold)} /><KV k="Slug" v={<span dir="ltr">{p.slug}</span>} /><KV k="به‌روزرسانی" v={jdate(p.updatedAt, true)} />
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">{p.shortDesc}</p>
          <div className="mt-2 flex flex-wrap gap-1" dir="ltr">{p.crossRefs.map((x) => <Badge key={x}>{x}</Badge>)}</div>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">پیشنهادهای تأمین‌کنندگان</h2>
      <Table head={["فروشنده", "قیمت", "موجودی/رزرو", "ارسال", "آماده‌سازی", "وضعیت", "Buy Box", ""]} empty={!offers.length}>
        {offers.map(({ o, s }) => (
          <tr key={o.id}><Td><b>{s.shopName}</b><div className="text-xs text-slate-500">{s.city}</div></Td><Td>{toman(o.salePrice ?? o.price)}{o.salePrice && <s className="mr-1 text-xs text-slate-400">{faNum(o.price)}</s>}</Td>
            <Td>{faNum(o.stock)} / {faNum(o.reserved)}</Td><Td>{toman(o.shippingCost)}</Td><Td>{faNum(o.prepDays)} روز</Td><Td><StatusBadge status={o.status} map={OFFER_STATUS} /></Td><Td>{o.isBuyBox ? "⭐" : ""}</Td>
            <Td>{canOffers && <div className="flex flex-wrap gap-1">
              {o.status !== "approved" && <ActionButton url={`/api/admin/offers/${o.id}/status`} data={{ status: "approved" }} className="btn-success">تأیید</ActionButton>}
              {o.status === "pending" && <ActionButton url={`/api/admin/offers/${o.id}/status`} data={{ status: "rejected" }} className="btn-danger">رد</ActionButton>}
              {o.status === "approved" && <><ActionButton url={`/api/admin/offers/${o.id}/status`} data={{ status: "suspended" }} className="btn-sm">تعلیق</ActionButton>{!o.isBuyBox && <ActionButton url={`/api/admin/offers/${o.id}/buybox`} className="btn-sm">Buy Box</ActionButton>}</>}
            </div>}</Td></tr>
        ))}
      </Table>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card title="تنوع‌ها">{vars.length ? vars.map((v) => <KV key={v.id} k={`${v.title} (${v.sku})`} v={`${toman(v.price)} · موجودی ${faNum(v.onHand - v.reserved)}${v.isActive ? "" : " · غیرفعال"}`} />) : <p className="text-sm text-slate-500">بدون تنوع</p>}</Card>
        <Card title="گردش موجودی">{moves.map((m) => <KV key={m.id} k={`${m.type} ${m.note ?? ""}`} v={`${faNum(m.qty)} · ${jdate(m.createdAt)}`} />)}{!moves.length && <p className="text-sm text-slate-500">—</p>}</Card>
        <Card title="تاریخچه تغییرات (Audit)">{logs.map((l) => <KV key={l.id} k={l.action} v={jdate(l.createdAt, true)} />)}{!logs.length && <p className="text-sm text-slate-500">—</p>}</Card>
      </div>
    </>
  );
}
