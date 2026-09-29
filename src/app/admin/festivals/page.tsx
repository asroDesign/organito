import { desc } from "drizzle-orm";
import { Flame } from "lucide-react";
import { db } from "@/db";
import { festivals } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionButton, JsonForm } from "@/components/client";
import { Countdown } from "@/components/Countdown";
import { categoryOptions } from "@/lib/queries";
import { faNum, jdate } from "@/lib/util";

export default async function Festivals() {
  await requirePage({ perm: "MARKETING_MANAGE" });
  const [list, cats] = await Promise.all([db.select().from(festivals).orderBy(desc(festivals.startsAt)), categoryOptions()]);
  const now = new Date();
  return (
    <>
      <PageHeader title="جشنواره‌های فروش" subtitle="تخفیف زمان‌دار خودکار روی همه محصولات، دسته‌ها یا محصولات منتخب — با نوار اطلاع‌رسانی و شمارش معکوس در سایت" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {list.length === 0 && <p className="text-sm text-slate-500">جشنواره‌ای تعریف نشده است.</p>}
          {list.map((f) => {
            const live = f.isActive && f.startsAt <= now && f.endsAt >= now;
            return (
              <div key={f.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-white" style={{ background: `linear-gradient(90deg, ${f.color}, #1e293b)` }}>
                  <div className="flex items-center gap-2"><Flame className="h-6 w-6" /><div><b className="text-lg">{f.title}</b><div className="text-xs opacity-80">{f.description}</div></div></div>
                  <div className="text-3xl font-black">{faNum(f.discountPercent)}٪</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div className="space-y-1">
                    <div>{jdate(f.startsAt)} تا {jdate(f.endsAt)}</div>
                    <div className="text-xs text-slate-500">دامنه: {f.productIds.length === 0 && f.categoryIds.length === 0 ? "همه محصولات" : [f.categoryIds.length ? `دسته‌ها: ${f.categoryIds.map((id) => cats.find((c) => c.id === id)?.name ?? id).join("، ")}` : "", f.productIds.length ? `${faNum(f.productIds.length)} محصول منتخب` : ""].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {live ? <><Badge tone="green">در حال اجرا</Badge><Countdown to={f.endsAt.toISOString()} compact /></> : f.startsAt > now ? <Badge tone="blue">زمان‌بندی‌شده</Badge> : f.endsAt < now ? <Badge tone="red">پایان‌یافته</Badge> : <Badge>غیرفعال</Badge>}
                    <ActionButton url={`/api/admin/festivals/${f.id}`} data={{ isActive: !f.isActive }} className="btn-sm">{f.isActive ? "توقف" : "فعال‌سازی"}</ActionButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Card title="ایجاد جشنواره">
          <JsonForm url="/api/admin/festivals" submit="ایجاد جشنواره" fields={[
            { name: "title", label: "عنوان", required: true, placeholder: "جشنواره یلدا" }, { name: "description", label: "توضیح کوتاه" },
            { name: "discountPercent", label: "درصد تخفیف", type: "number", required: true, half: true }, { name: "color", label: "رنگ (#hex)", half: true, defaultValue: "#e11d48" },
            { name: "startsAt", label: "شروع", type: "date", required: true, half: true }, { name: "endsAt", label: "پایان", type: "date", required: true, half: true },
            { name: "categoryIds", label: "دسته (خالی = همه)", type: "select", options: [["", "— همه محصولات —"], ...cats.map((c) => [String(c.id), c.name] as [string, string])] },
            { name: "productIds", label: "محصولات منتخب (شناسه‌ها با کاما)" },
          ]} />
          <p className="mt-3 text-xs text-slate-400">تخفیف جشنواره توسط پلتفرم تأمین و در حساب «هزینه تخفیفات و جشنواره‌ها» ثبت می‌شود؛ سهم فروشنده کامل پرداخت می‌گردد. در صورت هم‌پوشانی، بیشترین درصد اعمال می‌شود.</p>
        </Card>
      </div>
    </>
  );
}
