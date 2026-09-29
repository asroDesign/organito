import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, products, sellers, supplyHistory, supplyQuotes, supplyRequests, users, wallets, walletTransactions } from "@/db/schema";
import { audit, notify } from "../audit";
import { postJournal } from "../accounting";
import { getSettings } from "../settings";
import { sendSms } from "../sms";
import { HttpError } from "../util";
import type { Ctx, DB } from "../types";

export const SUPPLY_FLOW: Record<string, string[]> = {
  pending: ["reviewing", "rejected", "cancelled"],
  reviewing: ["internal_match_found", "supplier_search", "rejected", "cancelled"],
  internal_match_found: ["price_calculated", "supplier_search", "cancelled"],
  supplier_search: ["rfq_sent", "cancelled"],
  rfq_sent: ["supplier_found", "cancelled"],
  supplier_found: ["price_calculated", "rfq_sent", "cancelled"],
  price_calculated: ["quotation_sent", "price_calculated", "cancelled"],
  quotation_sent: ["customer_approved", "price_calculated", "cancelled"],
  customer_approved: ["payment_pending"],
  payment_pending: ["paid", "cancelled"],
  paid: ["purchasing"],
  purchasing: ["received", "shipped"],
  received: ["ready_to_ship"],
  ready_to_ship: ["shipped"],
  shipped: ["completed"],
};

async function move(tx: DB, ctx: Ctx, id: number, from: string, to: string, note: string, extra: Partial<typeof supplyRequests.$inferInsert> = {}) {
  if (from !== to && !(SUPPLY_FLOW[from] ?? []).includes(to)) throw new HttpError(400, `انتقال از «${from}» به «${to}» مجاز نیست`);
  await tx.update(supplyRequests).set({ ...extra, status: to, updatedAt: new Date() }).where(eq(supplyRequests.id, id));
  await tx.insert(supplyHistory).values({ requestId: id, fromStatus: from, toStatus: to, note, userId: ctx.userId });
  await audit(tx, ctx, "supply.transition", "supply_request", id, { status: from }, { status: to, ...extra });
}

export type SupplyAction =
  | { action: "review" } | { action: "search" } | { action: "rfq"; sellerIds?: number[] } | { action: "select_quote"; quoteId: number }
  | { action: "calculate"; margin: number } | { action: "send_quotation" } | { action: "assign"; assigneeId: number }
  | { action: "advance"; to: string; note?: string; carrier?: string; trackingNumber?: string } | { action: "reject"; note?: string };

export async function staffSupplyAction(ctx: Ctx & { userId: number }, id: number, a: SupplyAction) {
  let sms: { event: string; phone: string; vars: Record<string, string | number> } | null = null;
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, id)).for("update");
    if (!r) throw new HttpError(404, "درخواست یافت نشد");
    const [cust] = await tx.select().from(users).where(eq(users.id, r.customerId));
    switch (a.action) {
      case "assign":
        await tx.update(supplyRequests).set({ assigneeId: a.assigneeId }).where(eq(supplyRequests.id, id));
        await audit(tx, ctx, "supply.assign", "supply_request", id, { assigneeId: r.assigneeId }, { assigneeId: a.assigneeId });
        break;
      case "review":
        await move(tx, ctx, id, r.status, "reviewing", "بررسی کارشناس آغاز شد", { assigneeId: r.assigneeId ?? ctx.userId });
        break;
      case "search": {
        const pn = r.normalizedPn ?? "";
        const found = pn ? await tx.select().from(products).where(and(
          or(eq(products.normalizedPn, pn), sql`upper(regexp_replace(coalesce(${products.oemNumber},''), '[^A-Za-z0-9]', '', 'g')) = ${pn}`,
            sql`exists (select 1 from jsonb_array_elements_text(${products.crossRefs}) x where upper(regexp_replace(x, '[^A-Za-z0-9]', '', 'g')) = ${pn})`),
          sql`${products.status} <> 'deleted'`)).limit(1) : [];
        if (found[0]) await move(tx, ctx, id, r.status, "internal_match_found", `یافت‌شده در کاتالوگ: ${found[0].sku}`, { matchedProductId: found[0].id });
        else await move(tx, ctx, id, r.status, "supplier_search", "در کاتالوگ/نام‌های دیگر یافت نشد؛ جست‌وجوی تأمین‌کنندگان");
        break;
      }
      case "rfq": {
        const list = await tx.select().from(sellers).where(and(eq(sellers.status, "approved"), eq(sellers.restricted, false)));
        const targets = a.sellerIds?.length ? list.filter((s) => a.sellerIds!.includes(s.id)) : list;
        if (!targets.length) throw new HttpError(400, "تأمین‌کننده فعالی یافت نشد");
        for (const s of targets) {
          const [ex] = await tx.select().from(supplyQuotes).where(and(eq(supplyQuotes.requestId, id), eq(supplyQuotes.sellerId, s.id)));
          if (!ex) await tx.insert(supplyQuotes).values({ requestId: id, sellerId: s.id });
          await notify(tx, s.userId, `RFQ جدید ${r.number}`, r.partNumber ?? r.partName ?? "", "/seller/rfq");
        }
        await move(tx, ctx, id, r.status, "rfq_sent", `RFQ برای ${targets.length} تأمین‌کننده ارسال شد`);
        break;
      }
      case "select_quote": {
        const [q] = await tx.select().from(supplyQuotes).where(and(eq(supplyQuotes.id, a.quoteId), eq(supplyQuotes.requestId, id)));
        if (!q || q.status !== "quoted") throw new HttpError(400, "پیشنهاد معتبر نیست");
        await tx.update(supplyQuotes).set({ status: "rejected" }).where(and(eq(supplyQuotes.requestId, id), eq(supplyQuotes.status, "selected")));
        await tx.update(supplyQuotes).set({ status: "selected" }).where(eq(supplyQuotes.id, q.id));
        await tx.update(supplyRequests).set({ selectedQuoteId: q.id }).where(eq(supplyRequests.id, id));
        await audit(tx, ctx, "supply.select_quote", "supply_request", id, null, { quoteId: q.id, price: q.price });
        break;
      }
      case "calculate": {
        const margin = Math.max(0, Math.min(200, Math.floor(a.margin)));
        let cost = 0;
        if (r.selectedQuoteId) {
          const [q] = await tx.select().from(supplyQuotes).where(eq(supplyQuotes.id, r.selectedQuoteId));
          cost = q.price;
        } else if (r.matchedProductId) {
          const [p] = await tx.select().from(products).where(eq(products.id, r.matchedProductId));
          cost = p.avgCost || Math.round(p.basePrice / (1 + margin / 100));
        } else throw new HttpError(400, "ابتدا پیشنهاد تأمین‌کننده یا کالای کاتالوگ را انتخاب کنید");
        const s = await getSettings(tx);
        const unit = Math.ceil((cost * (1 + margin / 100)) / 1000) * 1000;
        const sub = unit * r.qty;
        const tax = Math.round((sub * s.taxRate) / 100);
        const total = sub + tax + s.supplyShippingCost;
        await move(tx, ctx, id, r.status, "price_calculated", `بهای تمام‌شده ${cost} + حاشیه ${margin}%`, { marginPercent: margin, unitSalePrice: unit, shippingCost: s.supplyShippingCost, quotationTotal: total });
        break;
      }
      case "send_quotation":
        if (!r.quotationTotal) throw new HttpError(400, "قیمت محاسبه نشده است");
        await move(tx, ctx, id, r.status, "quotation_sent", "پیش‌فاکتور برای مشتری صادر شد");
        await notify(tx, r.customerId, `پیش‌فاکتور ${r.number} صادر شد`, undefined, `/customer/supply/${id}`);
        if (cust) sms = { event: "quotation_sent", phone: cust.phone, vars: { request: r.number, amount: r.quotationTotal } };
        break;
      case "reject":
        await move(tx, ctx, id, r.status, "rejected", a.note || "رد درخواست");
        break;
      case "advance": {
        const allowedManual = ["purchasing", "received", "ready_to_ship", "shipped", "completed", "cancelled", "supplier_search", "supplier_found"];
        if (!allowedManual.includes(a.to)) throw new HttpError(400, "این وضعیت به‌صورت دستی قابل تنظیم نیست");
        if (a.to === "cancelled" && ["paid", "purchasing", "received", "ready_to_ship", "shipped"].includes(r.status)) throw new HttpError(400, "درخواست پرداخت‌شده قابل لغو مستقیم نیست");
        const extra: Partial<typeof supplyRequests.$inferInsert> = {};
        if (a.to === "shipped") {
          if (!a.carrier || !a.trackingNumber) throw new HttpError(400, "شرکت حمل و کد رهگیری الزامی است");
          extra.carrier = a.carrier; extra.trackingNumber = a.trackingNumber;
        }
        if (a.to === "supplier_found") {
          const quoted = await tx.select().from(supplyQuotes).where(and(eq(supplyQuotes.requestId, id), eq(supplyQuotes.status, "quoted")));
          if (!quoted.length) throw new HttpError(400, "هنوز پیشنهادی دریافت نشده است");
        }
        await move(tx, ctx, id, r.status, a.to, a.note ?? "", extra);
        if (a.to === "completed") await completeSupplyAccounting(tx, ctx, r);
        break;
      }
    }
  });
  const s = sms as { event: string; phone: string; vars: Record<string, string | number> } | null;
  if (s) void sendSms(s.event, s.phone, s.vars);
}

async function completeSupplyAccounting(tx: DB, ctx: Ctx, r: typeof supplyRequests.$inferSelect) {
  const sub = r.unitSalePrice * r.qty;
  const tax = r.quotationTotal - sub - r.shippingCost;
  await postJournal(tx, `تحقق فروش تأمین سفارشی ${r.number}`, [
    { code: "2103", debit: r.quotationTotal }, { code: "4104", credit: sub }, { code: "4103", credit: r.shippingCost }, { code: "2201", credit: tax },
  ], { type: "supply", id: r.id }, ctx.userId);
  if (r.selectedQuoteId) {
    const [q] = await tx.select().from(supplyQuotes).where(eq(supplyQuotes.id, r.selectedQuoteId));
    const cost = q.price * r.qty;
    const [w] = await tx.select().from(wallets).where(eq(wallets.sellerId, q.sellerId)).for("update");
    if (w) {
      await tx.update(wallets).set({ availableBalance: w.availableBalance + cost }).where(eq(wallets.id, w.id));
      await tx.insert(walletTransactions).values({ walletId: w.id, type: "supply_purchase", bucket: "available", amount: cost, refType: "supply", refId: r.id, note: `خرید تأمین ${r.number}` });
    }
    await postJournal(tx, `بهای تمام‌شده تأمین ${r.number}`, [{ code: "5101", debit: cost }, { code: "2102", credit: cost, detail1: `seller:${q.sellerId}` }], { type: "supply", id: r.id }, ctx.userId);
  } else if (r.matchedProductId) {
    const [p] = await tx.select().from(products).where(eq(products.id, r.matchedProductId)).for("update");
    const cost = p.avgCost * r.qty;
    if (p.onHand - p.reserved >= r.qty) await tx.update(products).set({ onHand: p.onHand - r.qty }).where(eq(products.id, p.id));
    if (cost > 0) await postJournal(tx, `بهای تمام‌شده تأمین ${r.number}`, [{ code: "5101", debit: cost }, { code: "1201", credit: cost }], { type: "supply", id: r.id }, ctx.userId);
  }
}

export async function customerSupplyAction(ctx: Ctx & { userId: number }, id: number, action: "approve" | "pay" | "cancel", idemKey?: string, existingPaymentId?: number) {
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, id)).for("update");
    if (!r || r.customerId !== ctx.userId) throw new HttpError(404, "درخواست یافت نشد");
    if (action === "approve") {
      await move(tx, ctx, id, r.status, "customer_approved", "پیش‌فاکتور توسط مشتری تأیید شد");
      await move(tx, ctx, id, "customer_approved", "payment_pending", "در انتظار پرداخت");
    } else if (action === "pay") {
      if (!idemKey) throw new HttpError(400, "کلید یکتا الزامی است");
      const [dup] = await tx.select().from(payments).where(eq(payments.idempotencyKey, idemKey));
      if (dup) return;
      if (r.status !== "payment_pending") throw new HttpError(400, "در وضعیت پرداخت نیست");
      let pay: typeof payments.$inferSelect;
      if (existingPaymentId) {
        const [ex] = await tx.select().from(payments).where(and(eq(payments.id, existingPaymentId), eq(payments.supplyRequestId, id))).for("update");
        if (!ex || ex.status !== "initiated" || ex.amount !== r.quotationTotal) throw new HttpError(400, "پرداخت معتبر نیست");
        [pay] = await tx.update(payments).set({ status: "success", verifiedAt: new Date() }).where(eq(payments.id, ex.id)).returning();
      } else {
        [pay] = await tx.insert(payments).values({ supplyRequestId: id, amount: r.quotationTotal, refCode: `PG${Date.now()}`, idempotencyKey: idemKey }).returning();
      }
      await postJournal(tx, `پیش‌دریافت تأمین ${r.number}`, [{ code: "1101", debit: r.quotationTotal }, { code: "2103", credit: r.quotationTotal }], { type: "supply", id }, ctx.userId);
      await move(tx, ctx, id, r.status, "paid", `پرداخت موفق ${pay.refCode}`);
    } else {
      if (!["pending", "reviewing", "quotation_sent", "payment_pending", "internal_match_found", "supplier_search", "rfq_sent", "supplier_found", "price_calculated"].includes(r.status)) throw new HttpError(400, "قابل لغو نیست");
      await move(tx, ctx, id, r.status, "cancelled", "لغو توسط مشتری");
    }
  });
}

export async function sellerQuote(ctx: Ctx & { userId: number }, sellerId: number, quoteId: number, data: { price: number; stock: number; leadDays: number; brand?: string; note?: string }) {
  await db.transaction(async (tx) => {
    const [q] = await tx.select().from(supplyQuotes).where(eq(supplyQuotes.id, quoteId)).for("update");
    if (!q || q.sellerId !== sellerId) throw new HttpError(404, "RFQ یافت نشد");
    if (!["requested", "quoted"].includes(q.status)) throw new HttpError(400, "RFQ بسته شده است");
    const [r] = await tx.select().from(supplyRequests).where(eq(supplyRequests.id, q.requestId)).for("update");
    if (!["rfq_sent", "supplier_found"].includes(r.status)) throw new HttpError(400, "مهلت پاسخ به RFQ تمام شده است");
    await tx.update(supplyQuotes).set({ ...data, status: "quoted" }).where(eq(supplyQuotes.id, q.id));
    if (r.status === "rfq_sent") await move(tx, ctx, r.id, r.status, "supplier_found", "اولین پیشنهاد تأمین‌کننده دریافت شد");
    if (r.assigneeId) await notify(tx, r.assigneeId, `پیشنهاد جدید برای ${r.number}`, undefined, `/admin/supply/${r.id}`);
    await audit(tx, ctx, "supply.quote", "supply_quote", q.id, null, data);
  });
}
