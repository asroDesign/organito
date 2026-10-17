import { desc, eq } from "drizzle-orm";
import { BadgePercent, CalendarClock } from "lucide-react";
import { db } from "@/db";
import { products, productVariants, variantScheduledDiscounts } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { jdate } from "@/lib/util";
import { Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { VariantDiscountForm } from "@/components/VariantDiscountForm";

export default async function VariantDiscountsPage() {
  await requirePage({ perm: "MARKETING_MANAGE" });
  const rows = await db.select({ discount: variantScheduledDiscounts, variant: productVariants, product: products }).from(variantScheduledDiscounts)
    .innerJoin(productVariants, eq(productVariants.id, variantScheduledDiscounts.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .orderBy(desc(variantScheduledDiscounts.startsAt), desc(variantScheduledDiscounts.id)).limit(200);
  const now = new Date();
  return <>
    <PageHeader title="تخفیف زمان‌بندی‌شدهٔ تنوع‌ها" subtitle="برای هر تنوع بازهٔ مستقل تعریف کنید؛ قیمت فروش از بهای خرید پایین‌تر نمی‌رود." />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Card title={<span className="flex items-center gap-2"><CalendarClock className="size-4 text-amber-600"/>تخفیف‌های ثبت‌شده</span>}>
        <div className="hidden md:block"><Table head={["محصول و تنوع", "درصد", "بازهٔ زمانی تهران", "وضعیت", "اقدام"]} empty={!rows.length}>
          {rows.map(({ discount, variant, product }) => {
            const live = discount.isActive && discount.startsAt <= now && discount.endsAt > now;
            const future = discount.isActive && discount.startsAt > now;
            return <tr key={discount.id} className="hover:bg-slate-50"><Td><b>{product.nameFa}</b><small className="mt-1 block text-slate-500">{variant.title}</small><small className="mt-1 block text-slate-400" dir="ltr">{variant.sku}</small><small className="mt-1 block text-amber-800">{discount.title}</small></Td><Td><b className="text-lg">{discount.discountPercent.toLocaleString("fa-IR")}٪</b></Td><Td><span className="block">شروع: {jdate(discount.startsAt, true)}</span><span className="mt-1 block">پایان: {jdate(discount.endsAt, true)}</span></Td><Td>{live ? <Badge tone="green">در حال اجرا</Badge> : future ? <Badge tone="blue">زمان‌بندی‌شده</Badge> : discount.endsAt <= now ? <Badge tone="gray">پایان‌یافته</Badge> : <Badge tone="gray">متوقف</Badge>}</Td><Td>{discount.isActive && <ActionButton url={`/api/admin/variant-discounts/${discount.id}`} data={{ isActive: false }} confirm={`تخفیف «${discount.title}» متوقف شود؟`} success="تخفیف متوقف شد" className="btn-sm text-rose-700">توقف</ActionButton>}</Td></tr>;
          })}
        </Table></div>
        <div className="space-y-3 md:hidden">{rows.map(({discount,variant,product})=>{const live=discount.isActive&&discount.startsAt<=now&&discount.endsAt>now;const future=discount.isActive&&discount.startsAt>now;return <article key={discount.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block break-words">{product.nameFa}</b><span className="mt-1 block text-xs text-slate-500">{variant.title}</span><span className="mt-1 block break-all text-[10px] text-slate-400" dir="ltr">{variant.sku}</span></div><b className="shrink-0 text-lg text-amber-700">{discount.discountPercent.toLocaleString("fa-IR")}٪</b></div><p className="mt-2 text-xs text-slate-600">{discount.title}</p><div className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-lg bg-slate-50 p-2">شروع: {jdate(discount.startsAt,true)}</div><div className="rounded-lg bg-slate-50 p-2">پایان: {jdate(discount.endsAt,true)}</div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2">{live?<Badge tone="green">در حال اجرا</Badge>:future?<Badge tone="blue">زمان‌بندی‌شده</Badge>:discount.endsAt<=now?<Badge tone="gray">پایان‌یافته</Badge>:<Badge tone="gray">متوقف</Badge>}{discount.isActive&&<ActionButton url={`/api/admin/variant-discounts/${discount.id}`} data={{isActive:false}} confirm={`تخفیف «${discount.title}» متوقف شود؟`} success="تخفیف متوقف شد" className="btn-sm text-rose-700">توقف</ActionButton>}</div></article>})}{!rows.length&&<p className="py-6 text-center text-sm text-slate-400">تخفیفی ثبت نشده است.</p>}</div>
      </Card>
      <Card title={<span className="flex items-center gap-2"><BadgePercent className="size-4 text-amber-600"/>زمان‌بندی تخفیف جدید</span>}>
        <VariantDiscountForm />
        <div className="mt-4 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-6 text-emerald-950"><b>قواعد قیمت‌گذاری</b><p>تخفیف اختصاصی تنوع و جشنواره روی هم جمع نمی‌شوند؛ درصد مؤثر از گزینهٔ قوی‌تر انتخاب می‌شود. کد تخفیف پس از آن فقط وقتی پذیرفته می‌شود که مجموع قیمت اقلام مرکزی را زیر مجموع بهای خرید نبرد.</p><p>زمان شروع و پایان با تقویم شمسی وارد و با ساعت تهران ذخیره می‌شود. بازهٔ هم‌پوشان برای یک تنوع رد می‌شود.</p></div>
      </Card>
    </div>
  </>;
}
