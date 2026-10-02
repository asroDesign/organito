import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, detailAccounts, journalEntries, journalLines, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { faNum, jdate, toman } from "@/lib/util";

export const metadata = { title: "روکش سند حسابداری" };

export default async function JournalCoverPrint({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "ACCOUNTING_MANAGE" });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const [entry] = await db.select({ entry: journalEntries, creator: users.name })
    .from(journalEntries).leftJoin(users, eq(users.id, journalEntries.createdBy)).where(eq(journalEntries.id, id));
  if (!entry) notFound();
  const settings = await getSettings();
  const lines = await db.select({ line: journalLines, code: accounts.code, account: accounts.name, d1: detailAccounts.name })
    .from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .leftJoin(detailAccounts, eq(detailAccounts.id, journalLines.detail1Id))
    .where(eq(journalLines.entryId, id)).orderBy(journalLines.id);
  const debit = lines.reduce((sum, row) => sum + row.line.debit, 0);
  const credit = lines.reduce((sum, row) => sum + row.line.credit, 0);
  const box = "border border-slate-500 p-2";
  const cell = "border border-slate-500 px-2 py-1.5";
  return <main dir="rtl" className="mx-auto max-w-[210mm] text-slate-950">
    <div className="no-print mb-4 flex justify-between px-2"><Link href="/admin/accounting?tab=journal" className="btn-ghost">بازگشت به اسناد</Link><PrintButton label="چاپ روکش سند" /></div>
    <article className="journal-cover min-h-[270mm] bg-white p-8 text-[12px] leading-6 shadow print:min-h-0 print:p-5 print:text-[11px]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-2 border-slate-800 p-3">
        <div className="text-right"><div className="text-lg font-black">{settings.siteName}</div><div className="text-[10px]">واحد مالی و حسابداری</div></div>
        <div className="px-4 text-center"><h1 className="whitespace-nowrap text-xl font-black">روکش سند حسابداری</h1><div className="mt-1 text-xs">{entry.entry.status === "reversed" ? "برگشت‌خورده" : "ثبت‌شده"}</div></div>
        <div className="text-left"><div>شماره سند: <b dir="ltr">{faNum(entry.entry.number)}</b></div><div>تاریخ سند: <b>{jdate(entry.entry.entryDate)}</b></div></div>
      </header>
      <section className="mt-3 grid grid-cols-2 gap-2">
        <div className={box}>شرح سند: <b>{entry.entry.description}</b></div>
        <div className={box}>مرجع: <b dir="ltr">{entry.entry.refType ?? "—"}{entry.entry.refId ? ` #${entry.entry.refId}` : ""}</b></div>
        <div className={box}>تنظیم‌کننده سند: <b>{entry.creator ?? "سیستم"}</b></div>
        <div className={box}>تعداد آرتیکل: <b>{faNum(lines.length)}</b></div>
      </section>
      <table className="mt-3 w-full border-collapse text-center">
        <thead><tr className="bg-slate-100 font-bold">{["ردیف", "کد حساب", "شرح حساب", "طرف حساب / تفصیلی", "شرح آرتیکل", "بدهکار", "بستانکار"].map((label) => <th key={label} className={cell}>{label}</th>)}</tr></thead>
        <tbody>
          {lines.map(({ line, code, account, d1 }, i) => <tr key={line.id} className="break-inside-avoid"><td className={cell}>{faNum(i + 1)}</td><td className={cell} dir="ltr">{code}</td><td className={`${cell} text-right`}>{account}</td><td className={cell}>{d1 ?? line.detail1 ?? "—"}</td><td className={`${cell} text-right`}>{line.description ?? "—"}</td><td className={cell}>{line.debit ? faNum(line.debit) : "—"}</td><td className={cell}>{line.credit ? faNum(line.credit) : "—"}</td></tr>)}
          <tr className="bg-slate-100 font-black"><td className={cell} colSpan={5}>جمع آرتیکل‌ها</td><td className={cell}>{faNum(debit)}</td><td className={cell}>{faNum(credit)}</td></tr>
          <tr className="font-bold"><td className={cell} colSpan={5}>تراز سند</td><td className={cell} colSpan={2}>{debit === credit ? "متوازن" : `اختلاف: ${toman(Math.abs(debit - credit))}`}</td></tr>
        </tbody>
      </table>
      <section className="mt-3 grid grid-cols-2 gap-2">
        <div className={`${box} min-h-12`}>مبلغ به حروف: ................................................................................................................................................</div>
        <div className={`${box} min-h-12`}>پیوست / توضیحات: .............................................................................................................................................</div>
      </section>
      <footer className="mt-12 grid grid-cols-3 gap-8 text-center text-xs">
        {["تنظیم‌کننده", "بررسی‌کننده", "تأییدکننده"].map((title) => <div key={title} className="min-h-20 border-t border-slate-600 pt-2">نام، امضا و تاریخ<br /><b>{title}</b></div>)}
      </footer>
      <div className="mt-4 border-t border-slate-300 pt-2 text-center text-[9px] text-slate-600">این روکش همراه با مستندات و پیوست‌های مالی سند بایگانی شود.</div>
    </article>
    <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } .journal-cover { box-shadow: none !important; } }`}</style>
  </main>;
}
