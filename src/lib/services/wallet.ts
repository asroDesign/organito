import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellers, users, wallets, walletTransactions, withdrawals } from "@/db/schema";
import { audit, notify } from "../audit";
import { postJournal } from "../accounting";
import { getSettings } from "../settings";
import { sendSms } from "../sms";
import { HttpError } from "../util";
import type { Ctx } from "../types";

export async function requestWithdrawal(ctx: Ctx & { userId: number }, sellerId: number, amount: number, iban: string, idemKey: string) {
  if (!/^IR\d{24}$/.test(iban)) throw new HttpError(400, "شماره شبا باید با IR و ۲۴ رقم باشد");
  const res = await db.transaction(async (tx) => {
    const [dup] = await tx.select().from(withdrawals).where(eq(withdrawals.idempotencyKey, idemKey));
    if (dup) return dup;
    const s = await getSettings(tx);
    if (amount < s.minWithdrawal) throw new HttpError(400, `حداقل مبلغ برداشت ${s.minWithdrawal.toLocaleString("fa-IR")} تومان است`);
    const [w] = await tx.select().from(wallets).where(eq(wallets.sellerId, sellerId)).for("update");
    if (!w) throw new HttpError(404, "کیف پول یافت نشد");
    if (amount > w.availableBalance) throw new HttpError(400, "مبلغ بیش از موجودی قابل برداشت است");
    await tx.update(wallets).set({ availableBalance: w.availableBalance - amount, lockedBalance: w.lockedBalance + amount, updatedAt: new Date() }).where(eq(wallets.id, w.id));
    const [wd] = await tx.insert(withdrawals).values({ sellerId, amount, iban, idempotencyKey: idemKey }).returning();
    await tx.insert(walletTransactions).values({ walletId: w.id, type: "withdraw_lock", bucket: "available", amount: -amount, refType: "withdrawal", refId: wd.id, note: "قفل مبلغ برای برداشت" });
    await audit(tx, ctx, "withdrawal.request", "withdrawal", wd.id, null, { amount, iban: `${iban.slice(0, 6)}***` });
    return wd;
  });
  const [u] = await db.select().from(users).where(eq(users.id, ctx.userId));
  if (u) void sendSms("withdrawal_requested", u.phone, { amount });
  return res;
}

export async function reviewWithdrawal(ctx: Ctx & { userId: number }, id: number, action: "approve" | "reject" | "process" | "pay" | "cancel", trackingCode?: string, note?: string, bySellerId?: number) {
  let paid: { amount: number; tracking: string; sellerId: number } | null = null;
  const res = await db.transaction(async (tx) => {
    const [wd] = await tx.select().from(withdrawals).where(eq(withdrawals.id, id)).for("update");
    if (!wd || (bySellerId && wd.sellerId !== bySellerId)) throw new HttpError(404, "درخواست یافت نشد");
    const allowed: Record<string, string[]> = { approve: ["pending"], reject: ["pending", "approved"], process: ["approved"], pay: ["approved", "processing"], cancel: ["pending"] };
    if (!allowed[action].includes(wd.status)) throw new HttpError(400, "انتقال وضعیت مجاز نیست");
    const [w] = await tx.select().from(wallets).where(eq(wallets.sellerId, wd.sellerId)).for("update");
    const map = { approve: "approved", reject: "rejected", process: "processing", pay: "paid", cancel: "cancelled" } as const;
    const status = map[action];
    if (action === "reject" || action === "cancel") {
      await tx.update(wallets).set({ lockedBalance: w.lockedBalance - wd.amount, availableBalance: w.availableBalance + wd.amount }).where(eq(wallets.id, w.id));
      await tx.insert(walletTransactions).values({ walletId: w.id, type: "withdraw_unlock", bucket: "available", amount: wd.amount, refType: "withdrawal", refId: wd.id, note: "آزادسازی مبلغ قفل‌شده" });
    }
    if (action === "pay") {
      if (!trackingCode) throw new HttpError(400, "شماره پیگیری بانکی الزامی است");
      await tx.update(wallets).set({ lockedBalance: w.lockedBalance - wd.amount, withdrawnBalance: w.withdrawnBalance + wd.amount }).where(eq(wallets.id, w.id));
      await tx.insert(walletTransactions).values({ walletId: w.id, type: "withdraw_paid", bucket: "withdrawn", amount: wd.amount, refType: "withdrawal", refId: wd.id, note: `واریز - پیگیری ${trackingCode}` });
      await postJournal(tx, `پرداخت تسویه فروشنده - درخواست #${wd.id}`, [
        { code: "2102", debit: wd.amount, detail1: `seller:${wd.sellerId}` }, { code: "1101", credit: wd.amount },
      ], { type: "withdrawal", id: wd.id }, ctx.userId);
      paid = { amount: wd.amount, tracking: trackingCode, sellerId: wd.sellerId };
    }
    const [upd] = await tx.update(withdrawals).set({ status, trackingCode: trackingCode ?? wd.trackingCode, note: note ?? wd.note, reviewedBy: ctx.userId, updatedAt: new Date() }).where(eq(withdrawals.id, id)).returning();
    const [sel] = await tx.select().from(sellers).where(eq(sellers.id, wd.sellerId));
    if (sel) await notify(tx, sel.userId, `درخواست برداشت: ${status}`, undefined, "/seller/wallet");
    await audit(tx, ctx, `withdrawal.${action}`, "withdrawal", wd.id, { status: wd.status }, { status, trackingCode });
    return upd;
  });
  const p = paid as { amount: number; tracking: string; sellerId: number } | null;
  if (p) {
    const [row] = await db.select({ phone: users.phone }).from(sellers).innerJoin(users, eq(users.id, sellers.userId)).where(eq(sellers.id, p.sellerId));
    if (row) void sendSms("settlement_paid", row.phone, { amount: p.amount, tracking: p.tracking });
  }
  return res;
}
