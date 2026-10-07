import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { discountCodes, discountUsages, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader, Table, Td } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { DiscountCodeForm } from "@/components/DiscountCodeForm";
import { categoryOptions } from "@/lib/queries";
import { faNum, jdate, toman } from "@/lib/util";

export default async function Discounts() {
  await requirePage({ perm: "MARKETING_MANAGE" });
  const [codes, cats] = await Promise.all([db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt)), categoryOptions()]);
  const custIds = codes.map((c) => c.customerId).filter(Boolean) as number[];
  const custs = custIds.length ? await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, custIds)) : [];
  const usage = await db.select().from(discountUsages);
  const now = new Date();
  const state = (c: (typeof codes)[number]) => !c.isActive ? ["غیرفعال", "gray"] : c.endsAt && c.endsAt < now ? ["منقضی", "red"] : c.startsAt && c.startsAt > now ? ["زمان‌بندی‌شده", "blue"] : c.usageLimit !== null && c.usedCount >= c.usageLimit ? ["تمام‌شده", "yellow"] : ["فعال", "green"];
  return (
    <>
      <PageHeader title="کدهای تخفیف" subtitle="درصدی یا مبلغ ثابت · محدود به مشتری خاص، محصولات یا دسته‌ها · سقف استفاده کل و هر کاربر · بازه زمانی" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Table head={["کد", "مقدار", "محدودیت", "استفاده", "اعتبار", "وضعیت", ""]} empty={!codes.length}>
          {codes.map((c) => {
            const [l, t] = state(c);
            const cust = custs.find((x) => x.id === c.customerId);
            const total = usage.filter((u) => u.codeId === c.id).reduce((a, u) => a + u.amount, 0);
            return (
              <tr key={c.id} className="align-top">
                <Td><b dir="ltr" className="font-mono">{c.code}</b><div className="text-xs text-slate-500">{c.title}</div></Td>
                <Td>{c.type === "percent" ? `${faNum(c.value)}٪` : toman(c.value)}{c.maxDiscount > 0 && <div className="text-[11px] text-slate-400">سقف {toman(c.maxDiscount)}</div>}{c.minOrder > 0 && <div className="text-[11px] text-slate-400">حداقل خرید {toman(c.minOrder)}</div>}</Td>
                <Td className="text-xs">{cust ? <div>👤 {cust.name}<small className="block text-slate-500" dir="ltr">{cust.phone}</small></div> : c.targetPhone ? <div>📱 محدود به موبایل<small className="block text-slate-500" dir="ltr">{c.targetPhone}</small></div> : <div className="text-slate-400">همه مشتریان</div>}{c.productIds.length > 0 && <div>📦 {faNum(c.productIds.length)} محصول</div>}{c.categoryIds.length > 0 && <div>🗂 {c.categoryIds.map((id) => cats.find((x) => x.id === id)?.name ?? id).join("، ")}</div>}<div>هر کاربر: {c.perUserLimit ? faNum(c.perUserLimit) : "∞"}</div></Td>
                <Td>{faNum(c.usedCount)}{c.usageLimit ? ` / ${faNum(c.usageLimit)}` : ""}<div className="text-[11px] text-slate-400">{toman(total)}</div></Td>
                <Td className="text-xs">{c.startsAt ? `از ${jdate(c.startsAt)}` : "—"}<div>{c.endsAt ? `تا ${jdate(c.endsAt)}` : "بدون انقضا"}</div></Td>
                <Td><Badge tone={t}>{l}</Badge></Td>
                <Td><ActionButton url={`/api/admin/discounts/${c.id}`} data={{ isActive: !c.isActive }} className="btn-sm">{c.isActive ? "غیرفعال" : "فعال"}</ActionButton></Td>
              </tr>
            );
          })}
        </Table>
        <Card title="تعریف کد تخفیف"><DiscountCodeForm categories={cats.map(({ id, name }) => ({ id, name }))} /></Card>
      </div>
    </>
  );
}
