import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerWalletWithdrawals, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { CustomerWithdrawalManager } from "@/components/CustomerWithdrawalManager";

export default async function CustomerWalletWithdrawalsPage(){await requirePage({perm:"WITHDRAWALS_MANAGE"});const rows=await db.select({id:customerWalletWithdrawals.id,name:users.name,phone:users.phone,amount:customerWalletWithdrawals.amount,bankInfo:customerWalletWithdrawals.bankInfo,status:customerWalletWithdrawals.status,createdAt:customerWalletWithdrawals.createdAt}).from(customerWalletWithdrawals).innerJoin(users,eq(users.id,customerWalletWithdrawals.userId)).orderBy(desc(customerWalletWithdrawals.createdAt)).limit(300);return <CustomerWithdrawalManager initial={rows}/>}
