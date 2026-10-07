import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Award, ArrowLeft, Check, Sparkles } from "lucide-react";
import { db } from "@/db";
import { loyaltyTierHistory, users } from "@/db/schema";
import { customerLoyaltyTier, loyaltyProgram } from "@/lib/services/loyalty-tiers";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { faNum, jdate, toman } from "@/lib/util";

const tierNames = { bronze: "برنزی", silver: "نقره‌ای", gold: "طلایی" } as const;

export default async function CustomerLoyaltyPage() {
  const user = await requirePage();
  const [tier, program, [account], history] = await Promise.all([
    customerLoyaltyTier(db, user.id, user.phone), loyaltyProgram(db),
    db.select({ points: users.marketingPoints }).from(users).where(eq(users.id, user.id)),
    db.select().from(loyaltyTierHistory).where(and(eq(loyaltyTierHistory.phone, user.phone), eq(loyaltyTierHistory.userId, user.id))).orderBy(desc(loyaltyTierHistory.createdAt)).limit(30),
  ]);
  return <div className="space-y-5">
    <PageHeader title="باشگاه وفاداری" subtitle="سطح عضویت و امتیازهای وفاداری شما بر اساس خریدهای آنلاین و حضوری" actions={<Link href="/customer/wallet" className="btn-ghost">کیف پول و امتیازها <ArrowLeft className="size-4"/></Link>}/>
    {!program.enabled ? <Card><div className="flex items-start gap-3"><Award className="mt-1 size-5 text-amber-600"/><div><b>باشگاه سطح‌بندی‌شده فعلاً غیرفعال است</b><p className="mt-1 text-sm leading-7 text-slate-500">امتیازهای خرید و کیف پول شما همچنان فعال هستند. پس از فعال‌سازی باشگاه توسط مدیریت، سطح و مزایای شما در این صفحه نمایش داده می‌شود.</p></div></div></Card> : <>
      <section className="grid gap-3 sm:grid-cols-2"><Stat icon={Award} label="سطح فعلی" value={tier.name} tone="yellow"/><Stat icon={Sparkles} label="امتیاز خرید و معرفی" value={faNum(account?.points ?? 0)} tone="violet"/></section>
      <Card title={`سطح ${tier.name}`} action={<Badge tone="yellow">ضریب امتیاز خرید {faNum(tier.pointsMultiplierBps / 10000)}×</Badge>}>
        <p className="text-sm leading-7 text-slate-600">خریدهای واجد شرایط: <b>{toman(tier.lifetimeSpent)}</b>.{tier.nextTier ? <> برای رسیدن به سطح <b>{tier.nextTier.name}</b>، <b>{toman(tier.nextTier.minimumSpend - tier.lifetimeSpent)}</b> خرید دیگر نیاز است.</> : " شما در بالاترین سطح باشگاه هستید."}</p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-yellow-500 transition-all" style={{width:`${tier.progress}%`}}/></div>
        <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{faNum(tier.progress)}٪ از مسیر سطح بعد</span><span>{tier.nextTier ? toman(tier.nextTier.minimumSpend) : "بالاترین سطح"}</span></div>
      </Card>
      <section className="grid gap-3 md:grid-cols-3">{program.tiers.map((rule) => <Card key={rule.code} className={rule.code===tier.code?"border-amber-300 ring-1 ring-amber-200":""} title={rule.name} action={rule.code===tier.code?<Badge tone="yellow">سطح فعلی</Badge>:undefined}><div className="space-y-2 text-sm"><p>حداقل خرید: <b>{toman(rule.minimumSpend)}</b></p><p>ضریب امتیاز خرید: <b>{faNum(rule.pointsMultiplierBps/10000)}×</b></p>{rule.code===tier.code&&<div className="flex items-center gap-1 pt-1 text-xs font-bold text-emerald-700"><Check className="size-4"/>مزایای این سطح برای خرید بعدی اعمال می‌شود</div>}</div></Card>)}</section>
      <Card title="تغییرهای سطح عضویت"><div className="divide-y divide-slate-100">{history.map((event) => <div key={event.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><span className="flex-1">سطح {tierNames[event.fromTier as keyof typeof tierNames] ?? event.fromTier} به {tierNames[event.toTier as keyof typeof tierNames] ?? event.toTier} تغییر کرد <span className="text-xs text-slate-500">· {event.reason}</span></span><span className="text-xs text-slate-500">{jdate(event.createdAt,true)}</span></div>)}{!history.length&&<p className="py-5 text-center text-sm text-slate-500">با تغییر سطح، سوابق آن در این فهرست ثبت می‌شود.</p>}</div></Card>
    </>}
  </div>;
}
