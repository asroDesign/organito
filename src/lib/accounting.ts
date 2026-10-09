import { eq, sql } from "drizzle-orm";
import { accounts, detailAccounts, journalEntries, journalLines } from "@/db/schema";
import { HttpError } from "./util";
import type { DB } from "./types";

export const CHART: { code: string; name: string; level: string; type: string; parent?: string }[] = [
  { code: "1", name: "دارایی‌ها", level: "group", type: "asset" },
  { code: "11", name: "دارایی‌های جاری", level: "general", type: "asset", parent: "1" },
  { code: "1101", name: "بانک و درگاه پرداخت", level: "subsidiary", type: "asset", parent: "11" },
  { code: "1102", name: "حساب‌های دریافتنی", level: "subsidiary", type: "asset", parent: "11" },
  { code: "1201", name: "موجودی کالا", level: "subsidiary", type: "asset", parent: "11" },
  { code: "2", name: "بدهی‌ها", level: "group", type: "liability" },
  { code: "21", name: "بدهی‌های جاری", level: "general", type: "liability", parent: "2" },
  { code: "2101", name: "کیف پول فروشندگان - در انتظار", level: "subsidiary", type: "liability", parent: "21" },
  { code: "2102", name: "کیف پول فروشندگان - قابل برداشت", level: "subsidiary", type: "liability", parent: "21" },
  { code: "2103", name: "پیش‌دریافت مشتریان", level: "subsidiary", type: "liability", parent: "21" },
  { code: "2104", name: "حساب‌های پرداختنی", level: "subsidiary", type: "liability", parent: "21" },
  { code: "2105", name: "پورسانت همکاران فروش پرداختنی", level: "subsidiary", type: "liability", parent: "21" },
  { code: "2201", name: "مالیات بر ارزش افزوده پرداختنی", level: "subsidiary", type: "liability", parent: "21" },
  { code: "3", name: "حقوق صاحبان سهام", level: "group", type: "equity" },
  { code: "3101", name: "سرمایه", level: "subsidiary", type: "equity", parent: "3" },
  { code: "4", name: "درآمدها", level: "group", type: "revenue" },
  { code: "4101", name: "فروش کالا - انبار مرکزی", level: "subsidiary", type: "revenue", parent: "4" },
  { code: "4102", name: "درآمد کمیسیون مارکت‌پلیس", level: "subsidiary", type: "revenue", parent: "4" },
  { code: "4103", name: "درآمد حمل", level: "subsidiary", type: "revenue", parent: "4" },
  { code: "4104", name: "فروش تأمین سفارشی", level: "subsidiary", type: "revenue", parent: "4" },
  { code: "4105", name: "مازاد موجودی ناشی از تعدیل", level: "subsidiary", type: "revenue", parent: "4" },
  { code: "5", name: "هزینه‌ها", level: "group", type: "expense" },
  { code: "5101", name: "بهای تمام‌شده کالای فروش‌رفته", level: "subsidiary", type: "expense", parent: "5" },
  { code: "5201", name: "هزینه حمل و گمرک", level: "subsidiary", type: "expense", parent: "5" },
  { code: "5302", name: "هزینه پورسانت همکاری در فروش", level: "subsidiary", type: "expense", parent: "5" },
  { code: "8101", name: "کالای امانی نزد فروشگاه (انتظامی)", level: "subsidiary", type: "memorandum" },
  { code: "8201", name: "مالکیت دیگران بر کالای امانی (انتظامی)", level: "subsidiary", type: "memorandum" },
];

export type Line = { code: string; debit?: number; credit?: number; detail1?: string; description?: string; detail1Id?: number | null; detail2Id?: number | null; detail3Id?: number | null };

export async function postJournal(tx: DB, description: string, lines: Line[], ref?: { type: string; id: number }, userId?: number | null, entryDate?: Date) {
  const clean = lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);
  const d = clean.reduce((s, l) => s + (l.debit ?? 0), 0);
  const c = clean.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (d !== c) throw new HttpError(500, `سند نامتوازن: بدهکار ${d} ≠ بستانکار ${c}`);
  if (d === 0) return null;
  for (const l of clean) {
    if (!Number.isInteger(l.debit ?? 0) || !Number.isInteger(l.credit ?? 0)) throw new HttpError(500, "مبلغ اعشاری در سند");
  }
  const accs = await tx.select().from(accounts);
  const map = new Map(accs.map((a) => [a.code, a.id]));
  await tx.execute(sql`select pg_advisory_xact_lock(77001)`);
  const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${journalEntries.number}), 1000)::int` }).from(journalEntries);
  const [entry] = await tx.insert(journalEntries).values({
    number: Number(n) + 1, description, refType: ref?.type, refId: ref?.id, createdBy: userId ?? null, entryDate: entryDate ?? new Date(),
  }).returning();
  // auto-link seller postings to their detail account (code S-<id>)
  const detailCodes = clean.map((l) => l.detail1?.startsWith("seller:") ? `S-${l.detail1.slice(7)}` : l.detail1?.startsWith("affiliate:") ? `A-${l.detail1.slice(10)}` : null).filter(Boolean) as string[];
  const dmap = new Map<string, number>();
  if (detailCodes.length) {
    const ds = await tx.select().from(detailAccounts);
    for (const d of ds) dmap.set(d.code, d.id);
  }
  await tx.insert(journalLines).values(clean.map((l) => {
    const accountId = map.get(l.code);
    if (!accountId) throw new HttpError(500, `حساب ${l.code} یافت نشد`);
    const auto = l.detail1?.startsWith("seller:") ? dmap.get(`S-${l.detail1.slice(7)}`) ?? null : l.detail1?.startsWith("affiliate:") ? dmap.get(`A-${l.detail1.slice(10)}`) ?? null : null;
    return { entryId: entry.id, accountId, debit: l.debit ?? 0, credit: l.credit ?? 0, detail1: l.detail1, description: l.description,
      detail1Id: l.detail1Id ?? auto, detail2Id: l.detail2Id ?? null, detail3Id: l.detail3Id ?? null };
  }));
  return entry;
}

export async function reverseJournal(tx: DB, entryId: number, reason: string, userId?: number | null, reference?: { type: string; id: number }) {
  const [entry] = await tx.select().from(journalEntries).where(eq(journalEntries.id, entryId)).for("update");
  if (!entry) throw new HttpError(404, "سند یافت نشد");
  if (entry.status === "reversed") throw new HttpError(400, "سند قبلاً برگشت خورده است");
  const lines = await tx.select({ l: journalLines, code: accounts.code }).from(journalLines)
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(eq(journalLines.entryId, entryId));
  const rev = await postJournal(tx, `برگشت سند ${entry.number}: ${reason}`,
    lines.map(({ l, code }) => ({ code, debit: l.credit, credit: l.debit, detail1: l.detail1 ?? undefined, detail1Id: l.detail1Id, detail2Id: l.detail2Id, detail3Id: l.detail3Id })),
    reference ?? { type: "reversal", id: entry.id }, userId);
  if (rev) await tx.update(journalEntries).set({ reversalOf: entry.id }).where(eq(journalEntries.id, rev.id));
  await tx.update(journalEntries).set({ status: "reversed" }).where(eq(journalEntries.id, entryId));
  return rev;
}
