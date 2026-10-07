import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { affiliateClicks, affiliateEarnings, affiliateProfiles, affiliateProgramSettings, affiliateWithdrawals } from "@/db/schema";
import AffiliateCustomerClient from "@/components/AffiliateCustomerClient";
import { requirePage } from "@/lib/auth";
import { affiliateAvailableBalance } from "@/lib/services/affiliates";

export default async function CustomerAffiliatePage() {
  const user = await requirePage();
  const [[config], [profile], [clicks], earnings, withdrawals] = await Promise.all([
    db.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1)),
    db.select().from(affiliateProfiles).where(eq(affiliateProfiles.userId, user.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(affiliateClicks).where(eq(affiliateClicks.affiliateUserId, user.id)),
    db.select({ earning: affiliateEarnings, orderNumber: sql<string>`(select number from orders where id=${affiliateEarnings.orderId})` }).from(affiliateEarnings).where(eq(affiliateEarnings.affiliateUserId, user.id)).orderBy(desc(affiliateEarnings.createdAt)).limit(100),
    db.select().from(affiliateWithdrawals).where(eq(affiliateWithdrawals.affiliateUserId, user.id)).orderBy(desc(affiliateWithdrawals.createdAt)).limit(50),
  ]);
  return <AffiliateCustomerClient initial={{ enabled: config?.enabled ?? false, config: config ? { minimumWithdrawal: config.minimumWithdrawal, attributionDays: config.attributionDays } : null, profile: profile ? { ...profile, createdAt: profile.createdAt.toISOString() } : null, clicks: Number(clicks?.count ?? 0), available: profile ? await affiliateAvailableBalance(db, user.id) : 0, earnings: earnings.map((x) => ({ earning: { ...x.earning, createdAt: x.earning.createdAt.toISOString(), availableAt: x.earning.availableAt?.toISOString() ?? null }, orderNumber: x.orderNumber })), withdrawals: withdrawals.map((w) => ({ ...w, createdAt: w.createdAt.toISOString(), processedAt: w.processedAt?.toISOString() ?? null })) }}/>;
}
