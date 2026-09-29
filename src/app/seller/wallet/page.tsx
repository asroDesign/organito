import { desc, eq } from "drizzle-orm";
import { Clock, Wallet, Lock, ArrowUpFromLine } from "lucide-react";
import { db } from "@/db";
import { sellers, wallets, walletTransactions, withdrawals } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, Stat, StatusBadge, Table, Td } from "@/components/ui";
import { ActionButton, JsonForm } from "@/components/client";
import { WITHDRAW_STATUS, jdate, maskIban, toman } from "@/lib/util";

export default async function SellerWallet() {
  const u = await requirePage({ role: "seller" });
  const sid = u.sellerId!;
  const [[w], [s], wds, settings] = await Promise.all([db.select().from(wallets).where(eq(wallets.sellerId, sid)), db.select().from(sellers).where(eq(sellers.id, sid)), db.select().from(withdrawals).where(eq(withdrawals.sellerId, sid)).orderBy(desc(withdrawals.createdAt)), getSettings()]);
  const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.walletId, w.id)).orderBy(desc(walletTransactions.createdAt)).limit(50);
  return (
    <>
      <PageHeader title="کیف پول و برداشت" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="در انتظار آزادسازی (pending)" value={toman(w.pendingBalance)} icon={Clock} tone="yellow" />
        <Stat label="قابل برداشت (available)" value={toman(w.availableBalance)} icon={Wallet} tone="green" />
        <Stat label="قفل‌شده برای برداشت" value={toman(w.lockedBalance)} icon={Lock} tone="blue" />
        <Stat label="برداشت‌شده (withdrawn)" value={toman(w.withdrawnBalance)} icon={ArrowUpFromLine} tone="violet" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card title="درخواست برداشت">
          <p className="mb-3 text-xs text-slate-500">حداقل مبلغ: {toman(settings.minWithdrawal)} · مبلغ درخواستی تا بررسی مدیر قفل می‌شود.</p>
          <JsonForm url="/api/seller/withdrawals" submit="ثبت درخواست" idempotent fields={[
            { name: "amount", label: "مبلغ (تومان)", type: "number", required: true },
            { name: "iban", label: "شماره شبا", required: true, defaultValue: s.iban ?? "", placeholder: "IR..." },
          ]} />
        </Card>
        <div className="space-y-6">
          <Table head={["مبلغ", "شبا", "تاریخ", "وضعیت", "پیگیری", ""]} empty={!wds.length}>
            {wds.map((d) => <tr key={d.id}><Td><b>{toman(d.amount)}</b></Td><Td><span dir="ltr">{maskIban(d.iban)}</span></Td><Td>{jdate(d.createdAt, true)}</Td><Td><StatusBadge status={d.status} map={WITHDRAW_STATUS} /></Td><Td>{d.trackingCode ?? "—"}</Td><Td>{d.status === "pending" && <ActionButton url={`/api/seller/withdrawals/${d.id}/cancel`} className="btn-sm" confirm="لغو درخواست؟">لغو</ActionButton>}</Td></tr>)}
          </Table>
          <Card title="تراکنش‌های کیف پول">
            <div className="divide-y text-sm">{txs.map((t) => <div key={t.id} className="flex items-center justify-between gap-2 py-2"><div><b>{t.note}</b><div className="text-xs text-slate-400">{t.type} · {t.bucket} · {jdate(t.createdAt, true)}</div></div><b className={t.amount >= 0 ? "text-emerald-600" : "text-rose-600"} dir="ltr">{t.amount.toLocaleString("fa-IR")}</b></div>)}</div>
          </Card>
        </div>
      </div>
    </>
  );
}
