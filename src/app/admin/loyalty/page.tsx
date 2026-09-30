import { desc } from "drizzle-orm";
import { db } from "@/db";
import { centralLoyaltyMembers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import AdminLoyaltyClient from "@/components/AdminLoyaltyClient";

export default async function AdminLoyaltyPage(){
 await requirePage({perm:"SMS_MANAGE"});
 const members=await db.select().from(centralLoyaltyMembers).orderBy(desc(centralLoyaltyMembers.updatedAt)).limit(2000);
 return <><PageHeader title="باشگاه مشتریان مرکزی" subtitle="اعضای صندوق مرکزی، رضایت پیامکی و ارسال تبریک تولد"/><AdminLoyaltyClient initial={JSON.parse(JSON.stringify(members))}/></>;
}
