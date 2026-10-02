import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customerWalletEntries, customerWallets, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { WalletPanel } from "@/components/CustomerSelfService";
import { getSettings } from "@/lib/settings";

export default async function CustomerWalletPage() {
  const u=await requirePage();
  await db.insert(customerWallets).values({userId:u.id}).onConflictDoNothing();
  const [[wallet],[me],entries,cfg]=await Promise.all([
    db.select().from(customerWallets).where(eq(customerWallets.userId,u.id)),
    db.select({bankInfo:users.bankInfo,marketingPoints:users.marketingPoints}).from(users).where(eq(users.id,u.id)),
    db.select().from(customerWalletEntries).where(eq(customerWalletEntries.userId,u.id)).orderBy(customerWalletEntries.createdAt).limit(100),
    getSettings(),
  ]);
  return <WalletPanel initial={{balance:wallet?.balance??0,bankInfo:(me?.bankInfo??{}) as Record<string,string>,points:me?.marketingPoints??0,pointValue:cfg.loyaltyPointValue,entries:entries.reverse().map(e=>({...e,createdAt:e.createdAt.toISOString()}))}}/>;
}
