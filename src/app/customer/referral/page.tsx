import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { ReferralPanel } from "@/components/CustomerSelfService";

export default async function CustomerReferralPage(){const u=await requirePage();let [me]=await db.select().from(users).where(eq(users.id,u.id));if(!me)throw new Error("حساب کاربری پیدا نشد");if(!me.referralCode){const code=`SBZ${u.id}${Math.random().toString(36).slice(2,7)}`.toUpperCase();const [updated]=await db.update(users).set({referralCode:code}).where(eq(users.id,u.id)).returning();if(updated)me=updated;}const referrals=await db.select({id:users.id,name:users.name,createdAt:users.createdAt}).from(users).where(eq(users.referredById,u.id)).orderBy(desc(users.createdAt));return <ReferralPanel initial={{code:me.referralCode!,points:me.marketingPoints,referrals:referrals.map(r=>({...r,createdAt:r.createdAt.toISOString()}))}}/>}
