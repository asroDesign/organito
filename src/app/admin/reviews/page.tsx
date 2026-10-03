import Link from "next/link";
import { desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { productAnswers, productQuestions, products, reviews, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { AnswerForm, ReviewReplyButton, Stars, ReviewImages, RoleBadge } from "@/components/Community";
import { faNum, jdate } from "@/lib/util";

const ST: Record<string, [string, string]> = { pending: ["در انتظار", "yellow"], approved: ["منتشرشده", "green"], rejected: ["ردشده", "red"] };

export default async function Moderation({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  await requirePage({ perm: "PRODUCTS_APPROVE" });
  const sp = await searchParams;
  const tab = sp.tab ?? "reviews";
  const status = sp.status ?? "pending";
  const where = (col: typeof reviews.status | typeof productQuestions.status | typeof productAnswers.status): SQL | undefined => (status === "all" ? undefined : eq(col, status));
  const [revs, qs, ans] = await Promise.all([
    tab === "reviews" ? db.select({ r: reviews, name: users.name, product: products.nameFa, slug: products.slug }).from(reviews).innerJoin(users, eq(users.id, reviews.userId)).innerJoin(products, eq(products.id, reviews.productId)).where(where(reviews.status)).orderBy(desc(reviews.createdAt)).limit(100) : Promise.resolve([]),
    tab === "questions" ? db.select({ q: productQuestions, name: users.name, product: products.nameFa, slug: products.slug }).from(productQuestions).innerJoin(users, eq(users.id, productQuestions.userId)).innerJoin(products, eq(products.id, productQuestions.productId)).where(where(productQuestions.status)).orderBy(desc(productQuestions.createdAt)).limit(100) : Promise.resolve([]),
    tab === "answers" ? db.select({ a: productAnswers, name: users.name, question: productQuestions.body }).from(productAnswers).innerJoin(users, eq(users.id, productAnswers.userId)).innerJoin(productQuestions, eq(productQuestions.id, productAnswers.questionId)).where(where(productAnswers.status)).orderBy(desc(productAnswers.createdAt)).limit(100) : Promise.resolve([]),
  ]);
  const counts = await Promise.all([reviews, productQuestions, productAnswers].map((t) => db.select({ id: t.id }).from(t).where(eq(t.status, "pending"))));
  const tabs: [string, string, number][] = [["reviews", "دیدگاه‌ها", counts[0].length], ["questions", "پرسش‌ها", counts[1].length], ["answers", "پاسخ‌ها", counts[2].length]];
  const q = (patch: Record<string, string>) => `?${new URLSearchParams({ tab, status, ...patch })}`;
  const answersForQs = qs.length ? await db.select({ a: productAnswers, name: users.name }).from(productAnswers).innerJoin(users, eq(users.id, productAnswers.userId)).where(inArray(productAnswers.questionId, qs.map((x) => x.q.id))).orderBy(desc(productAnswers.createdAt)) : [];
  return (
    <>
      <PageHeader title="دیدگاه‌ها و پرسش و پاسخ" subtitle="بررسی و انتشار دیدگاه‌ها (با نقاط قوت/ضعف و تصاویر)، پرسش‌ها و پاسخ‌های کاربران" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">{tabs.map(([k, l, n]) => <Link key={k} href={`?${new URLSearchParams({ tab: k, status })}`} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm ${tab === k ? "bg-emerald-600 font-bold text-white" : "text-slate-600"}`}>{l}{n > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === k ? "bg-white text-emerald-700" : "bg-amber-400 text-amber-950"}`}>{faNum(n)}</span>}</Link>)}</div>
        <div className="flex gap-1 text-xs">{[["pending", "در انتظار"], ["approved", "منتشرشده"], ["rejected", "ردشده"], ["all", "همه"]].map(([k, l]) => <Link key={k} href={q({ status: k })} className={`rounded-full px-3 py-1.5 ${status === k ? "bg-slate-800 text-white" : "bg-white ring-1 ring-slate-200"}`}>{l}</Link>)}</div>
      </div>
      <div className="space-y-3">
        {tab === "reviews" && (revs.length === 0 ? <Card><p className="text-sm text-slate-500">موردی نیست.</p></Card> : revs.map(({ r, name, product, slug }) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1"><div className="flex items-center gap-2"><Stars value={r.rating} size={14} /><b>{r.title ?? "بدون عنوان"}</b><Badge tone={ST[r.status][1]}>{ST[r.status][0]}</Badge>{r.verifiedPurchase && <Badge tone="green">خریدار</Badge>}</div>
                <div className="text-xs text-slate-500">{name} · <Link href={`/products/${slug}#reviews`} className="text-emerald-700" target="_blank">{product}</Link> · {jdate(r.createdAt, true)}</div></div>
              <div className="flex gap-1">{r.status !== "approved" && <ActionButton url={`/api/admin/reviews/${r.id}`} data={{ status: "approved" }} className="btn-success">انتشار</ActionButton>}{r.status !== "rejected" && <ActionButton url={`/api/admin/reviews/${r.id}`} data={{ status: "rejected" }} className="btn-danger">رد</ActionButton>}<ReviewReplyButton reviewId={r.id} status={r.status} initialReply={r.adminReply} /></div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-7">{r.body}</p>
            {(r.pros.length > 0 || r.cons.length > 0) && <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><div className="text-emerald-700">{r.pros.map((t, i) => <div key={i}>+ {t}</div>)}</div><div className="text-rose-600">{r.cons.map((t, i) => <div key={i}>− {t}</div>)}</div></div>}
            {r.mediaIds.length > 0 && <div className="mt-3"><ReviewImages ids={r.mediaIds} /></div>}
            {r.adminReply && <div className="mt-3 rounded-xl bg-emerald-50 p-2 text-xs">پاسخ فروشگاه: {r.adminReply}</div>}
          </Card>
        )))}
        {tab === "questions" && (qs.length === 0 ? <Card><p className="text-sm text-slate-500">موردی نیست.</p></Card> : qs.map(({ q: qq, name, product, slug }) => (
          <Card key={qq.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><b className="leading-7">{qq.body}</b><div className="text-xs text-slate-500">{name} · <Link href={`/products/${slug}#qa`} className="text-emerald-700" target="_blank">{product}</Link> · {jdate(qq.createdAt, true)} · {faNum(answersForQs.filter(({ a }) => a.questionId === qq.id).length)} پاسخ</div></div>
              <div className="flex items-center gap-1"><Badge tone={ST[qq.status][1]}>{ST[qq.status][0]}</Badge>{qq.status !== "approved" && <ActionButton url={`/api/admin/questions/${qq.id}`} data={{ status: "approved" }} className="btn-success">انتشار</ActionButton>}{qq.status !== "rejected" && <ActionButton url={`/api/admin/questions/${qq.id}`} data={{ status: "rejected" }} className="btn-danger">رد</ActionButton>}
                {qq.status === "approved" && <AnswerForm questionId={qq.id} loggedIn label="پاسخ فروشگاه" />}</div>
            </div>
            {answersForQs.filter(({ a }) => a.questionId === qq.id).length > 0 && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3"><h3 className="text-xs font-black text-slate-700">پاسخ‌های ثبت‌شده</h3>{answersForQs.filter(({ a }) => a.questionId === qq.id).map(({ a, name: answerName }) => <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2 text-xs"><RoleBadge role={a.role} /><b>{answerName}</b><Badge tone={ST[a.status][1]}>{ST[a.status][0]}</Badge><span className="text-slate-400">{jdate(a.createdAt, true)}</span></div><p className="whitespace-pre-line text-sm leading-7">{a.body}</p></div><div className="flex shrink-0 flex-wrap gap-1">{a.status !== "approved" && <ActionButton url={`/api/admin/answers/${a.id}`} data={{ status: "approved" }} className="btn-success">انتشار</ActionButton>}{a.status !== "rejected" && <ActionButton url={`/api/admin/answers/${a.id}`} data={{ status: "rejected" }} className="btn-danger">رد پاسخ</ActionButton>}<ActionButton url={`/api/admin/answers/${a.id}`} data={{ delete: true }} confirm="این پاسخ برای همیشه حذف شود؟" success="پاسخ حذف شد" className="btn-sm text-rose-600">حذف</ActionButton></div></div>)}</div>}
          </Card>
        )))}
        {tab === "answers" && (ans.length === 0 ? <Card><p className="text-sm text-slate-500">موردی نیست.</p></Card> : ans.map(({ a, name, question }) => (
          <Card key={a.id}>
            <div className="text-xs text-slate-500">در پاسخ به: «{question}»</div>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2 text-xs"><RoleBadge role={a.role} /><b>{name}</b><span className="text-slate-400">{jdate(a.createdAt, true)}</span></div><p className="text-sm leading-7">{a.body}</p></div>
              <div className="flex gap-1"><Badge tone={ST[a.status][1]}>{ST[a.status][0]}</Badge>{a.status !== "approved" && <ActionButton url={`/api/admin/answers/${a.id}`} data={{ status: "approved" }} className="btn-success">انتشار</ActionButton>}{a.status !== "rejected" && <ActionButton url={`/api/admin/answers/${a.id}`} data={{ status: "rejected" }} className="btn-danger">رد</ActionButton>}<ActionButton url={`/api/admin/answers/${a.id}`} data={{ delete: true }} confirm="این پاسخ برای همیشه حذف شود؟" success="پاسخ حذف شد" className="btn-sm text-rose-600">حذف</ActionButton></div></div>
          </Card>
        )))}
      </div>
    </>
  );
}
