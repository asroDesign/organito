import Link from "next/link";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { accounts, detailAccounts, journalEntries, journalLines } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, StatusBadge, Table, Td, KV } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { JournalForm2 } from "@/components/JournalForm2";
import { AccountManager, DetailManager } from "@/components/AccountManagers";
import { ReportFilter } from "@/components/ReportFilter";
import { faNum, jdate, toman } from "@/lib/util";

type SP = { tab?: string; account?: string; from?: string; to?: string; detail?: string };
type Bal = { id: number; code: string; name: string; type: string; level: string; parent_id: number | null; debit: number; credit: number };

const range = (sp: SP) => {
  const c: SQL[] = [];
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) c.push(gte(journalEntries.entryDate, new Date(`${sp.from}T00:00:00+03:30`)));
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) c.push(lte(journalEntries.entryDate, new Date(`${sp.to}T23:59:59+03:30`)));
  return c;
};
const rangeSql = (sp: SP) => {
  const f = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sql` and e.entry_date >= ${`${sp.from}T00:00:00+03:30`}::timestamptz` : sql``;
  const t = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sql` and e.entry_date <= ${`${sp.to}T23:59:59+03:30`}::timestamptz` : sql``;
  return sql`${f}${t}`;
};

export default async function Accounting({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePage({ perm: "ACCOUNTING_MANAGE" });
  const sp = await searchParams;
  const tab = sp.tab ?? "journal";
  const groups: [string, [string, string][]][] = [
    ["عملیات", [["journal", "اسناد"], ["new", "سند جدید"]]],
    ["تعاریف", [["accounts", "کدینگ حساب‌ها (کل/معین)"], ["details", "حساب‌های تفصیلی"]]],
    ["گزارش‌ها", [["trial", "تراز آزمایشی"], ["ledger", "دفتر کل / معین"], ["detailrep", "گزارش تفصیلی"], ["book", "دفتر روزنامه"], ["pl", "سود و زیان"], ["bs", "ترازنامه"], ["arap", "دریافتنی/پرداختنی"], ["sellers", "حساب فروشندگان"], ["cost", "حسابداری صنعتی"]]],
  ];
  const balRows = await db.execute(sql`select a.id, a.code, a.name, a.type, a.level, a.parent_id, coalesce(sum(l.debit),0)::bigint debit, coalesce(sum(l.credit),0)::bigint credit
    from accounts a left join (journal_lines l join journal_entries e on e.id = l.entry_id ${rangeSql(sp)}) on l.account_id = a.id group by a.id order by a.code`);
  const bals = (balRows.rows as Record<string, string>[]).map((r) => ({ ...r, id: Number(r.id), parent_id: r.parent_id ? Number(r.parent_id) : null, debit: Number(r.debit), credit: Number(r.credit) })) as unknown as Bal[];
  const leaf = bals.filter((b) => b.level === "subsidiary");
  const net = (b: Bal) => (["asset", "expense"].includes(b.type) ? b.debit - b.credit : b.credit - b.debit);
  const sum = (t: string) => leaf.filter((b) => b.type === t).reduce((a, b) => a + net(b), 0);
  const details = await db.select().from(detailAccounts).orderBy(detailAccounts.code);
  const q = (extra: Record<string, string>) => new URLSearchParams({ ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...extra }).toString();
  const needsRange = ["trial", "ledger", "detailrep", "book", "pl", "bs", "journal", "arap"].includes(tab);
  return (
    <>
      <PageHeader title="حسابداری دوبل" subtitle="کل · معین · تفصیلی سه‌سطحی · اسناد چندآرتیکلی متوازن · صدور خودکار اسناد خرید و فروش" />
      <div className="mb-5 space-y-2 rounded-2xl bg-white p-3 shadow-sm">
        {groups.map(([g, items]) => (
          <div key={g} className="flex flex-wrap items-center gap-1"><span className="ml-2 w-16 text-xs text-slate-400">{g}</span>
            {items.map(([k, l]) => <Link key={k} href={`?${q({ tab: k })}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-emerald-600 font-bold text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</Link>)}
          </div>
        ))}
      </div>
      {needsRange && <ReportFilter tab={tab} from={sp.from} to={sp.to} extra={{ account: sp.account, detail: sp.detail }} />}
      {tab === "journal" && <JournalList sp={sp} details={details} />}
      {tab === "new" && <Card title="ثبت سند چندآرتیکلی"><JournalForm2 accounts={leaf.map((a) => [a.code, `${a.code} - ${a.name}`])} details={details.filter((d) => d.isActive).map((d) => ({ id: d.id, code: d.code, name: d.name, level: d.level, parentId: d.parentId }))} /></Card>}
      {tab === "accounts" && <Card><AccountManager rows={bals.map((b) => ({ id: b.id, code: b.code, name: b.name, type: b.type, level: b.level, parentId: b.parent_id, balance: b.debit - b.credit }))} /></Card>}
      {tab === "details" && <Card><DetailManager rows={details.map((d) => ({ id: d.id, code: d.code, name: d.name, level: d.level, parentId: d.parentId, isActive: d.isActive }))} /></Card>}
      {tab === "trial" && <Trial bals={bals} />}
      {tab === "ledger" && <Ledger sp={sp} accountsList={leaf} details={details} />}
      {tab === "detailrep" && <DetailReport sp={sp} details={details} />}
      {tab === "book" && <JournalList sp={sp} details={details} compact />}
      {tab === "pl" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="درآمدها">{leaf.filter((b) => b.type === "revenue").map((b) => <KV key={b.id} k={b.name} v={toman(net(b))} />)}<div className="mt-2 border-t pt-2"><KV k="جمع درآمد" v={<b>{toman(sum("revenue"))}</b>} /></div></Card>
          <Card title="هزینه‌ها">{leaf.filter((b) => b.type === "expense").map((b) => <KV key={b.id} k={b.name} v={toman(net(b))} />)}<div className="mt-2 border-t pt-2"><KV k="جمع هزینه" v={<b>{toman(sum("expense"))}</b>} /></div></Card>
          <Card title="نتیجه دوره" className="md:col-span-2"><KV k="سود (زیان) خالص" v={<b className={sum("revenue") - sum("expense") >= 0 ? "text-emerald-600" : "text-rose-600"}>{toman(sum("revenue") - sum("expense"))}</b>} /><KV k="حاشیه سود" v={`${sum("revenue") ? faNum(Math.round(((sum("revenue") - sum("expense")) / sum("revenue")) * 100)) : "۰"}٪`} /></Card>
        </div>
      )}
      {tab === "bs" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="دارایی‌ها">{leaf.filter((b) => b.type === "asset").map((b) => <KV key={b.id} k={b.name} v={toman(net(b))} />)}<div className="mt-2 border-t pt-2"><KV k="جمع دارایی‌ها" v={<b>{toman(sum("asset"))}</b>} /></div></Card>
          <Card title="بدهی‌ها و حقوق صاحبان سهام">
            {leaf.filter((b) => b.type === "liability" || b.type === "equity").map((b) => <KV key={b.id} k={b.name} v={toman(net(b))} />)}
            <KV k="سود انباشته دوره" v={toman(sum("revenue") - sum("expense"))} />
            <div className="mt-2 border-t pt-2"><KV k="جمع" v={<b>{toman(sum("liability") + sum("equity") + sum("revenue") - sum("expense"))}</b>} /></div>
          </Card>
        </div>
      )}
      {tab === "arap" && <ArAp sp={sp} />}
      {tab === "sellers" && <SellerAccounts />}
      {tab === "cost" && <CostAccounting />}
    </>
  );
}

function Trial({ bals }: { bals: Bal[] }) {
  const levelName: Record<string, string> = { group: "گروه", general: "کل", subsidiary: "معین" };
  const childrenSum = (id: number): { d: number; c: number } => {
    const own = bals.find((b) => b.id === id)!;
    return bals.filter((b) => b.parent_id === id).reduce((a, ch) => { const s = childrenSum(ch.id); return { d: a.d + s.d, c: a.c + s.c }; }, { d: own.debit, c: own.credit });
  };
  const rows = bals.map((b) => ({ ...b, ...childrenSum(b.id) }));
  const leafRows = rows.filter((r) => r.level === "subsidiary");
  return (
    <Table head={["کد", "حساب", "سطح", "گردش بدهکار", "گردش بستانکار", "مانده بدهکار", "مانده بستانکار"]}>
      {rows.map((b) => { const d = b.d - b.c; return <tr key={b.id} className={b.level === "subsidiary" ? "" : "bg-slate-50 font-bold"}><Td>{b.code}</Td><Td><Link href={`?tab=ledger&account=${b.code}`} className="hover:text-emerald-700">{b.name}</Link></Td><Td>{levelName[b.level]}</Td><Td>{faNum(b.d)}</Td><Td>{faNum(b.c)}</Td><Td>{d > 0 ? faNum(d) : ""}</Td><Td>{d < 0 ? faNum(-d) : ""}</Td></tr>; })}
      <tr className="bg-emerald-50 font-extrabold"><Td /><Td>جمع (معین‌ها)</Td><Td /><Td>{faNum(leafRows.reduce((a, b) => a + b.d, 0))}</Td><Td>{faNum(leafRows.reduce((a, b) => a + b.c, 0))}</Td>
        <Td>{faNum(leafRows.reduce((a, b) => a + Math.max(0, b.d - b.c), 0))}</Td><Td>{faNum(leafRows.reduce((a, b) => a + Math.max(0, b.c - b.d), 0))}</Td></tr>
    </Table>
  );
}

async function JournalList({ sp, details, compact }: { sp: SP; details: (typeof detailAccounts.$inferSelect)[]; compact?: boolean }) {
  const c = range(sp);
  const entries = await db.select().from(journalEntries).where(c.length ? and(...c) : undefined).orderBy(compact ? journalEntries.entryDate : desc(journalEntries.number)).limit(compact ? 300 : 40);
  const lines = entries.length ? await db.select({ l: journalLines, code: accounts.code, name: accounts.name }).from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(inArray(journalLines.entryId, entries.map((e) => e.id))) : [];
  const dn = (id: number | null) => (id ? details.find((d) => d.id === id)?.name ?? "" : "");
  if (compact) {
    return (
      <Table head={["تاریخ", "سند", "شرح", "حساب", "تفصیلی", "بدهکار", "بستانکار"]} empty={!entries.length}>
        {entries.flatMap((e) => lines.filter((x) => x.l.entryId === e.id).map(({ l, code, name }, i) => (
          <tr key={l.id} className={i === 0 ? "border-t-2 border-slate-200" : ""}><Td>{i === 0 ? jdate(e.entryDate) : ""}</Td><Td>{i === 0 ? faNum(e.number) : ""}</Td><Td className="text-xs">{i === 0 ? e.description : ""}</Td><Td>{code} {name}</Td><Td className="text-xs">{[dn(l.detail1Id), dn(l.detail2Id), dn(l.detail3Id)].filter(Boolean).join(" / ")}</Td><Td>{l.debit ? faNum(l.debit) : ""}</Td><Td>{l.credit ? faNum(l.credit) : ""}</Td></tr>
        )))}
      </Table>
    );
  }
  return (
    <div className="space-y-3">
      {entries.length === 0 && <p className="text-sm text-slate-500">سندی در این بازه یافت نشد.</p>}
      {entries.map((e) => {
        const ls = lines.filter((x) => x.l.entryId === e.id);
        return (
          <Card key={e.id} title={<span className="flex flex-wrap items-center gap-2">سند {faNum(e.number)} — {e.description} <StatusBadge status={e.status} map={{ posted: "قطعی", reversed: "برگشت‌خورده" }} />{e.refType && e.refType !== "manual" && <span className="rounded bg-violet-50 px-2 text-[11px] text-violet-700">خودکار: {e.refType}</span>}</span>}
            action={<div className="flex items-center gap-2 text-xs text-slate-500"><a href={`/print/journal/${e.id}`} target="_blank" rel="noreferrer" className="btn-sm">چاپ روکش</a>تاریخ سند: {jdate(e.entryDate)} {e.status === "posted" && !e.reversalOf && <ActionButton url={`/api/admin/journal/${e.id}/reverse`} confirm="برگشت سند؟" className="btn-sm">برگشت</ActionButton>}</div>}>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-xs text-slate-400"><tr><th className="text-right">حساب معین</th><th className="text-right">تفصیلی ۱/۲/۳</th><th className="text-left">بدهکار</th><th className="text-left">بستانکار</th></tr></thead>
              <tbody>{ls.map(({ l, code, name }) => <tr key={l.id}><td className="py-1">{code} {name}</td><td className="text-xs text-slate-500">{[dn(l.detail1Id), dn(l.detail2Id), dn(l.detail3Id)].filter(Boolean).join(" / ") || l.detail1 || ""}</td><td className="text-left">{l.debit ? faNum(l.debit) : ""}</td><td className="text-left">{l.credit ? faNum(l.credit) : ""}</td></tr>)}
                <tr className="border-t font-bold"><td colSpan={2}>جمع</td><td className="text-left">{faNum(ls.reduce((a, x) => a + x.l.debit, 0))}</td><td className="text-left">{faNum(ls.reduce((a, x) => a + x.l.credit, 0))}</td></tr></tbody></table></div>
          </Card>
        );
      })}
    </div>
  );
}

async function Ledger({ sp, accountsList, details }: { sp: SP; accountsList: Bal[]; details: (typeof detailAccounts.$inferSelect)[] }) {
  const code = sp.account ?? "1101";
  const [acc] = await db.select().from(accounts).where(eq(accounts.code, code));
  const c = range(sp);
  const rows = acc ? await db.select({ l: journalLines, e: journalEntries }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId)).where(and(eq(journalLines.accountId, acc.id), ...c)).orderBy(journalEntries.entryDate, journalEntries.number) : [];
  const dn = (id: number | null) => (id ? details.find((d) => d.id === id)?.name ?? "" : "");
  let run = 0;
  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2"><input type="hidden" name="tab" value="ledger" />{sp.from && <input type="hidden" name="from" value={sp.from} />}{sp.to && <input type="hidden" name="to" value={sp.to} />}
        <select name="account" defaultValue={code} className="input !w-72">{accountsList.map((a) => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}</select><button className="btn-ghost">نمایش</button></form>
      <Table head={["سند", "تاریخ", "شرح", "تفصیلی", "بدهکار", "بستانکار", "مانده"]} empty={!rows.length}>
        {rows.map(({ l, e }) => { run += l.debit - l.credit; return <tr key={l.id}><Td>{faNum(e.number)}</Td><Td>{jdate(e.entryDate)}</Td><Td>{e.description}</Td><Td className="text-xs">{[dn(l.detail1Id), dn(l.detail2Id), dn(l.detail3Id)].filter(Boolean).join(" / ")}</Td><Td>{l.debit ? faNum(l.debit) : ""}</Td><Td>{l.credit ? faNum(l.credit) : ""}</Td><Td>{faNum(Math.abs(run))} {run >= 0 ? "بد" : "بس"}</Td></tr>; })}
      </Table>
    </>
  );
}

async function DetailReport({ sp, details }: { sp: SP; details: (typeof detailAccounts.$inferSelect)[] }) {
  const id = Number(sp.detail) || details.find((d) => d.level === 3)?.id || details[0]?.id;
  const d = details.find((x) => x.id === id);
  const rows = d ? (await db.execute(sql`select a.code, a.name, coalesce(sum(l.debit),0)::bigint debit, coalesce(sum(l.credit),0)::bigint credit
    from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id
    where (l.detail1_id = ${id} or l.detail2_id = ${id} or l.detail3_id = ${id}) ${rangeSql(sp)} group by a.code, a.name order by a.code`)).rows as Record<string, string>[] : [];
  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2"><input type="hidden" name="tab" value="detailrep" />{sp.from && <input type="hidden" name="from" value={sp.from} />}{sp.to && <input type="hidden" name="to" value={sp.to} />}
        <select name="detail" defaultValue={id} className="input !w-72">{details.map((x) => <option key={x.id} value={x.id}>{"—".repeat(x.level - 1)} {x.code} - {x.name} (سطح {x.level})</option>)}</select><button className="btn-ghost">نمایش</button></form>
      <Table head={["کد معین", "حساب", "بدهکار", "بستانکار", "مانده"]} empty={!rows.length}>
        {rows.map((r) => { const b = Number(r.debit) - Number(r.credit); return <tr key={r.code}><Td>{r.code}</Td><Td>{r.name}</Td><Td>{faNum(r.debit)}</Td><Td>{faNum(r.credit)}</Td><Td>{faNum(Math.abs(b))} {b >= 0 ? "بد" : "بس"}</Td></tr>; })}
      </Table>
    </>
  );
}

async function ArAp({ sp }: { sp: SP }) {
  const r = await db.execute(sql`select a.code, a.name, coalesce(d.name, l.detail1, 'بدون تفصیلی') party, sum(l.debit)::bigint debit, sum(l.credit)::bigint credit
    from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id left join detail_accounts d on d.id = l.detail1_id
    where a.code in ('1102','2104','2101','2102','2103') ${rangeSql(sp)} group by 1,2,3 order by 1,3`);
  const rows = r.rows as Record<string, string>[];
  return (
    <Table head={["حساب", "طرف حساب", "بدهکار", "بستانکار", "مانده"]} empty={!rows.length}>
      {rows.map((x, i) => { const b = Number(x.debit) - Number(x.credit); return <tr key={i}><Td>{x.code} {x.name}</Td><Td>{x.party}</Td><Td>{faNum(x.debit)}</Td><Td>{faNum(x.credit)}</Td><Td>{faNum(Math.abs(b))} {b >= 0 ? "بد" : "بس"}</Td></tr>; })}
    </Table>
  );
}

async function SellerAccounts() {
  const r = await db.execute(sql`select s.shop_name, s.commission_rate, w.pending_balance, w.available_balance, w.locked_balance, w.withdrawn_balance,
    (select coalesce(sum(commission),0) from seller_shipments sh where sh.seller_id = s.id and sh.settled)::bigint commission,
    (select coalesce(sum(case when a.code='2101' then l.credit-l.debit else 0 end),0) from journal_lines l join accounts a on a.id=l.account_id where l.detail1 = 'seller:' || s.id)::bigint gl_pending,
    (select coalesce(sum(case when a.code='2102' then l.credit-l.debit else 0 end),0) from journal_lines l join accounts a on a.id=l.account_id where l.detail1 = 'seller:' || s.id)::bigint gl_available
    from sellers s join wallets w on w.seller_id = s.id order by s.id`);
  const rows = r.rows as Record<string, string>[];
  return (
    <Table head={["فروشنده", "کمیسیون٪", "در انتظار (کیف/دفتر)", "قابل برداشت+قفل (کیف/دفتر)", "برداشت‌شده", "کمیسیون کسرشده"]}>
      {rows.map((x) => <tr key={x.shop_name}><Td>{x.shop_name}</Td><Td>{faNum(x.commission_rate)}</Td><Td>{faNum(x.pending_balance)} / {faNum(x.gl_pending)}</Td><Td>{faNum(Number(x.available_balance) + Number(x.locked_balance))} / {faNum(x.gl_available)}</Td><Td>{faNum(x.withdrawn_balance)}</Td><Td>{faNum(x.commission)}</Td></tr>)}
    </Table>
  );
}

async function CostAccounting() {
  const r = await db.execute(sql`select oi.title, case when oi.seller_id is null then 'انبار مرکزی' else s.shop_name end as source, sum(oi.qty)::int qty, sum(oi.line_total)::bigint revenue,
      sum(case when oi.seller_id is null then oi.unit_cost * oi.qty else 0 end)::bigint cogs,
      sum(case when oi.seller_id is not null then round(oi.line_total * s.commission_rate / 100.0) else 0 end)::bigint commission
    from order_items oi join seller_shipments sh on sh.id = oi.shipment_id left join sellers s on s.id = oi.seller_id
    where sh.status in ('shipped','delivered') group by 1,2 order by revenue desc`);
  const rows = r.rows as Record<string, string>[];
  return (
    <Table head={["محصول", "منبع", "تعداد", "فروش", "بهای تمام‌شده (COGS)", "سود ناخالص / کمیسیون", "حاشیه"]} empty={!rows.length}>
      {rows.map((x, i) => {
        const central = x.source === "انبار مرکزی";
        const gp = central ? Number(x.revenue) - Number(x.cogs) : Number(x.commission);
        return <tr key={i}><Td>{x.title}</Td><Td>{x.source}</Td><Td>{faNum(x.qty)}</Td><Td>{toman(Number(x.revenue))}</Td><Td>{central ? toman(Number(x.cogs)) : "—"}</Td><Td>{toman(gp)}</Td><Td>{Number(x.revenue) ? faNum(Math.round((gp / Number(x.revenue)) * 100)) : "۰"}٪</Td></tr>;
      })}
    </Table>
  );
}
