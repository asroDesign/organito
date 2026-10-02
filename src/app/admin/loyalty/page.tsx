import { desc } from "drizzle-orm";
import { db } from "@/db";
import { centralLoyaltyMembers } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import AdminLoyaltyClient from "@/components/AdminLoyaltyClient";

export default async function AdminLoyaltyPage(){
 await requirePage({perm:"SMS_MANAGE"});
 const [members,cfg]=await Promise.all([db.select().from(centralLoyaltyMembers).orderBy(desc(centralLoyaltyMembers.updatedAt)).limit(2000),getSettings()]);
 return <><PageHeader title="باشگاه مشتریان مرکزی" subtitle="اعضای صندوق مرکزی، رضایت پیامکی و ارسال تبریک تولد" actions={<Link className="btn-ghost" href="/admin/loyalty/reports">گزارش امتیازها</Link>}/><AdminLoyaltyClient initial={JSON.parse(JSON.stringify(members))} siteName={cfg.siteName} birthdayConfig={{percent:cfg.birthdayRewardPercent,minOrder:cfg.birthdayRewardMinOrder,validityDays:cfg.birthdayRewardValidityDays}}/></>;
}
