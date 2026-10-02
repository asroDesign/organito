import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loyaltyPointEntries, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { faNum, jdate, toman } from "@/lib/util";
const LABEL:Record<string,string>={purchase:"امتیاز خرید",referral:"امتیاز معرفی",conversion:"تبدیل به کیف پول"};
export default async function LoyaltyReports(){
 await requirePage({perm:"SMS_MANAGE"});
 const [rows,aggregate]=await Promise.all([
  db.select({entry:loyaltyPointEntries,name:users.name,phone:users.phone}).from(loyaltyPointEntries).innerJoin(users,eq(users.id,loyaltyPointEntries.userId)).orderBy(desc(loyaltyPointEntries.createdAt)).limit(1000),
  db.select({kind:loyaltyPointEntries.kind,points:sql<number>`sum(${loyaltyPointEntries.points})::int`}).from(loyaltyPointEntries).groupBy(loyaltyPointEntries.kind),
 ]);
 const totals=Object.fromEntries(aggregate.map(x=>[x.kind,x.kind==="conversion"?Math.abs(x.points):x.points]));
 return <><PageHeader title="گزارش امتیازهای مشتریان" subtitle="امتیاز خرید، معرفی دوستان و تبدیل امتیاز به اعتبار کیف پول" actions={<Link href="/admin/loyalty" className="btn-ghost">بازگشت به باشگاه</Link>}/><div className="mb-5 grid gap-3 sm:grid-cols-3">{["purchase","referral","conversion"].map(k=><div key={k} className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">{LABEL[k]}</div><b className="mt-2 block text-xl">{faNum(totals[k]??0)} امتیاز</b></div>)}</div><p className="mb-2 text-xs text-slate-500">آخرین ۱٬۰۰۰ رویداد ثبت‌شده</p><Table head={["تاریخ","مشتری","نوع رویداد","امتیاز","مبلغ تبدیل","شرح"]} empty={!rows.length}>{rows.map(({entry,name,phone})=><tr key={entry.id}><Td>{jdate(entry.createdAt,true)}</Td><Td><b>{name}</b><span dir="ltr" className="block text-xs text-slate-500">{phone}</span></Td><Td><Badge tone={entry.kind==="conversion"?"blue":entry.kind==="purchase"?"green":"gray"}>{LABEL[entry.kind]??entry.kind}</Badge></Td><Td className={entry.points<0?"text-rose-600":"text-emerald-700"}>{entry.points>0?"+":""}{faNum(entry.points)}</Td><Td>{entry.amount?toman(entry.amount):"—"}</Td><Td>{entry.description}</Td></tr>)}</Table></>;
}
