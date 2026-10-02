import { quoteCredit,reserveCredit,restoreCredit } from "../credit";
import { and, eq, inArray, sql, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  orders, orderItems, sellerShipments, orderHistory, payments, products, productVariants, sellerOffers, sellers,
  stockMovements, wallets, walletTransactions, users, discountCodes, discountUsages, carriers, referralAwards, incompleteCarts, loyaltyPointEntries, type Address,
} from "@/db/schema";
import { activeCarriers, activeFestivals, carrierCost, evaluateCode, festivalFor } from "../marketing";
import { audit, notify } from "../audit";
import { postJournal, reverseJournal, type Line } from "../accounting";
import { getSettings } from "../settings";
import { sendSms } from "../sms";
import { HttpError, genNumber } from "../util";
import type { Ctx, DB } from "../types";

export type CartInput = { productId: number; offerId?: number | null; variantId?: number | null; qty: number; selectedOptions?: Record<string, string | string[]> };

export type QuoteLine = {
  key: string; productId: number; offerId: number | null; variantId: number | null; sellerId: number | null;
  title: string; slug: string; imageId: number | null; unitPrice: number; qty: number; lineTotal: number; available: number; categoryId: number | null; weight: number; festivalPct: number; festivalTitle: string | null; listPrice: number;
  ok: boolean; error?: string; unitCost: number; allowBackorder: boolean;
  brand: string; partNumber: string; sku: string; authenticity: string; sellerName: string; attrs: Record<string, string>; variantTitle: string | null; warranty: string | null; maxQty: number;
  alternatives: { offerId: number; sellerId: number; shopName: string; price: number; available: number; prepDays: number; shippingCost: number; isBuyBox: boolean }[];
};
export type QuoteGroup = { key: string; sellerId: number | null; name: string; lines: QuoteLine[]; itemsTotal: number; shippingCost: number; prepDays: number; packages: number; weight: number };
export type CarrierOption = { id: number; name: string; cost: number; minDays: number; maxDays: number };
export type Quote = {
  creditAmount:number; giftCardId:number|null;
  lines: QuoteLine[]; groups: QuoteGroup[]; itemsSubtotal: number; sellerShippingTotal: number; centralShipping: number; discount: number; tax: number; finalTotal: number; valid: boolean;
  festivalDiscount: number; codeDiscount: number; code: { ok: boolean; error?: string; code?: string; title?: string; codeId?: number } | null;
  carriers: CarrierOption[]; carrierId: number | null; city: string;
};
export type QuoteOpts = { userId?: number | null; code?: string; city?: string; carrierId?: number | null; lockCode?: boolean };

export function sanitizeCart(raw: unknown): CartInput[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw new HttpError(400, "سبد خرید نامعتبر است");
  const out: CartInput[] = [];
  const seen = new Set<string>();
  for (const r of raw as Record<string, unknown>[]) {
    const productId = Math.floor(Number(r.productId));
    const offerId = r.offerId ? Math.floor(Number(r.offerId)) : null;
    const variantId = r.variantId ? Math.floor(Number(r.variantId)) : null;
    const qty = Math.floor(Number(r.qty));
    if (!(productId > 0) || !(qty > 0) || qty > 100) throw new HttpError(400, "قلم نامعتبر در سبد");
    const selectedOptions = r.selectedOptions && typeof r.selectedOptions === "object" && !Array.isArray(r.selectedOptions) ? Object.fromEntries(Object.entries(r.selectedOptions as Record<string, unknown>).slice(0, 20).map(([k, v]) => [String(k).slice(0, 80), Array.isArray(v) ? v.slice(0, 30).map((x) => String(x).slice(0, 80)) : String(v).slice(0, 300)])) as Record<string, string | string[]> : {};
    const key = `${productId}:${offerId ?? 0}:${variantId ?? 0}:${JSON.stringify(selectedOptions)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ productId, offerId, variantId, qty, selectedOptions });
  }
  return out;
}

function addPurchaseOptions(p: typeof products.$inferSelect, it: CartInput, basePrice: number): { price: number; title: string | null; error?: string } {
  const definitions = p.purchaseOptions ?? [];
  const selected = it.selectedOptions ?? {};
  for (const key of Object.keys(selected)) if (!definitions.some((o) => o.name === key)) return { price: basePrice, title: null, error: "گزینه انتخاب‌شده معتبر نیست" };
  let extra = 0; const labels: string[] = [];
  for (const option of definitions) {
    const raw = selected[option.name];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (option.required && values.length === 0) return { price: basePrice, title: null, error: `انتخاب گزینه «${option.name}» الزامی است` };
    if (option.type === "text") { if (values.length > 1 || (values[0] && values[0].length > 300)) return { price: basePrice, title: null, error: "مقدار متنی گزینه معتبر نیست" }; if (values[0]) labels.push(`${option.name}: ${values[0]}`); continue; }
    if (option.type !== "checkbox" && values.length > 1) return { price: basePrice, title: null, error: `برای «${option.name}» فقط یک انتخاب مجاز است` };
    for (const value of values) {
      const choice = option.values.find((v) => v.label === value);
      if (!choice) return { price: basePrice, title: null, error: `انتخاب «${option.name}» معتبر نیست` };
      extra += choice.priceType === "percent" ? Math.round(basePrice * choice.price / 100) : choice.price;
      labels.push(`${option.name}: ${value}`);
    }
  }
  return { price: basePrice + extra, title: labels.length ? labels.join("، ") : null };
}

async function alternativesFor(tx: DB, productId: number, qty: number) {
  const rows = await tx.select({ o: sellerOffers, s: sellers }).from(sellerOffers)
    .innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
    .where(and(eq(sellerOffers.productId, productId), eq(sellerOffers.status, "approved"), eq(sellers.status, "approved"), eq(sellers.restricted, false)));
  return rows
    .map(({ o, s }) => ({ offerId: o.id, sellerId: s.id, shopName: s.shopName, price: o.salePrice ?? o.price, available: o.stock - o.reserved, prepDays: o.prepDays, shippingCost: o.shippingCost, isBuyBox: o.isBuyBox }))
    .filter((a) => a.available >= qty)
    .sort((a, b) => Number(b.isBuyBox) - Number(a.isBuyBox) || a.price - b.price || a.prepDays - b.prepDays);
}

export async function quoteCart(tx: DB, items: CartInput[], lock: boolean, opts: QuoteOpts = {}): Promise<Quote> {
  const s = await getSettings(tx);
  const fests = await activeFestivals(tx);
  // deterministic lock order to avoid deadlocks
  const sorted = [...items].sort((a, b) => a.productId - b.productId || (a.offerId ?? 0) - (b.offerId ?? 0) || (a.variantId ?? 0) - (b.variantId ?? 0));
  const lines: QuoteLine[] = [];
  const sellerNames = new Map<number, string>();
  const offerShip = new Map<number, { ship: number; prep: number }>();
  for (const it of sorted) {
    const pq = tx.select().from(products).where(eq(products.id, it.productId));
    const [p] = lock ? await pq.for("update") : await pq;
    const base: QuoteLine = {
      key: `${it.productId}:${it.offerId ?? 0}:${it.variantId ?? 0}:${JSON.stringify(it.selectedOptions ?? {})}`, productId: it.productId, offerId: it.offerId ?? null, variantId: it.variantId ?? null,
      sellerId: null, title: p?.nameFa ?? "محصول نامشخص", slug: p?.slug ?? "", imageId: p?.mainImageId ?? null, unitPrice: 0, qty: it.qty, lineTotal: 0,
      available: 0, ok: false, unitCost: p?.avgCost ?? 0, allowBackorder: p?.allowBackorder ?? false, alternatives: [],
      categoryId: p?.categoryId ?? null, weight: (p?.weight ?? 0) > 0 ? p!.weight! : 500, festivalPct: 0, festivalTitle: null, listPrice: 0,
      brand: p?.brand ?? "", partNumber: p?.partNumber ?? "", sku: p?.sku ?? "", authenticity: p?.authenticity ?? "", sellerName: s.senderName, attrs: {}, variantTitle: null, warranty: null, maxQty: 0,
    };
    const fest = p ? festivalFor(fests, p.id, p.categoryId) : null;
    if (fest) { base.festivalPct = fest.discountPercent; base.festivalTitle = fest.title; }
    if (!p || (p.status !== "active" && !(p.status === "out_of_stock" && p.allowBackorder))) { lines.push({ ...base, error: "محصول قابل فروش نیست" }); continue; }
    const basePrice = it.offerId ? undefined : it.variantId ? undefined : p.basePrice;
    if (it.offerId) {
      const oq = tx.select({ o: sellerOffers, s: sellers }).from(sellerOffers).innerJoin(sellers, eq(sellers.id, sellerOffers.sellerId))
        .where(and(eq(sellerOffers.id, it.offerId), eq(sellerOffers.productId, p.id)));
      const [row] = lock ? await oq.for("update", { of: sellerOffers }) : await oq;
      if (!row || row.o.status !== "approved" || row.s.status !== "approved" || row.s.restricted) { lines.push({ ...base, error: "پیشنهاد فروشنده فعال نیست" }); continue; }
      const price = row.o.salePrice ?? row.o.price;
      const available = row.o.stock - row.o.reserved;
      sellerNames.set(row.s.id, row.s.shopName);
      const prev = offerShip.get(row.s.id);
      offerShip.set(row.s.id, { ship: Math.max(prev?.ship ?? 0, row.o.shippingCost), prep: Math.max(prev?.prep ?? 0, row.o.prepDays) });
      const ok = available >= it.qty;
      const option = addPurchaseOptions(p, it, price);
      lines.push({ ...base, allowBackorder: false, title: `${p.nameFa}`, variantTitle: option.title, sellerId: row.s.id, sellerName: row.s.shopName, warranty: row.o.warranty, maxQty: Math.min(100, Math.max(0, available)), unitPrice: option.price, lineTotal: option.price * it.qty, available, ok: ok && !option.error, unitCost: price,
        error: option.error ?? (ok ? undefined : "موجودی فروشنده کافی نیست"), alternatives: ok ? [] : await alternativesFor(tx, p.id, it.qty) });
    } else if (it.variantId) {
      const vq = tx.select().from(productVariants).where(and(eq(productVariants.id, it.variantId), eq(productVariants.productId, p.id)));
      const [v] = lock ? await vq.for("update") : await vq;
      if (!v || !v.isActive || !v.isSellable) { lines.push({ ...base, error: "این تنوع برای فروش مستقیم فعال نیست" }); continue; }
      const available = v.onHand - v.reserved;
      const ok = available >= it.qty || p.allowBackorder;
      const option = addPurchaseOptions(p, it, v.price);
      lines.push({ ...base, title: p.nameFa, variantTitle: [v.title, option.title].filter(Boolean).join(" · ") || null, attrs: v.attrs, maxQty: p.allowBackorder ? 100 : Math.min(100, Math.max(0, available)), unitPrice: option.price, lineTotal: option.price * it.qty, available, ok: ok && !option.error,
        error: option.error ?? (ok ? undefined : "موجودی انبار مرکزی کافی نیست"), alternatives: ok ? [] : await alternativesFor(tx, p.id, it.qty) });
    } else {
      if (p.source !== "central") { lines.push({ ...base, error: "برای این محصول فروشنده را انتخاب کنید", alternatives: await alternativesFor(tx, p.id, it.qty) }); continue; }
      const hasVariants = await tx.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true))).limit(1);
      if (hasVariants.length) { lines.push({ ...base, error: "برای این محصول باید تنوع (مشخصات) را از صفحه محصول انتخاب کنید", alternatives: await alternativesFor(tx, p.id, it.qty) }); continue; }
      const available = p.onHand - p.reserved;
      const ok = available >= it.qty || p.allowBackorder;
      const option = addPurchaseOptions(p, it, p.basePrice);
      lines.push({ ...base, allowBackorder: p.allowBackorder, variantTitle: option.title, maxQty: p.allowBackorder ? 100 : Math.min(100, Math.max(0, available)), unitPrice: option.price, lineTotal: option.price * it.qty, available, ok: ok && !option.error,
        error: option.error ?? (ok ? undefined : "موجودی انبار مرکزی کافی نیست"), alternatives: ok ? [] : await alternativesFor(tx, p.id, it.qty) });
    }
  }
  const groupsMap = new Map<string, QuoteGroup>();
  for (const l of lines) {
    const key = l.sellerId ? `s:${l.sellerId}` : "central";
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key, sellerId: l.sellerId, name: l.sellerId ? sellerNames.get(l.sellerId) ?? "فروشنده" : s.senderName, lines: [], itemsTotal: 0,
        shippingCost: l.sellerId ? offerShip.get(l.sellerId)?.ship ?? 0 : s.centralShippingCost,
        prepDays: l.sellerId ? offerShip.get(l.sellerId)?.prep ?? 1 : 1, packages: 0, weight: 0,
      });
    }
    const g = groupsMap.get(key)!;
    g.lines.push(l);
    if (l.ok) { g.itemsTotal += l.lineTotal; g.weight += l.weight * l.qty; }
  }
  // festival pricing (list price kept for display)
  for (const l of lines) {
    l.listPrice = l.unitPrice;
  }
  const groups = [...groupsMap.values()].filter((g) => g.lines.some((l) => l.ok));
  for (const g of groups) g.packages = Math.max(1, Math.ceil(g.lines.reduce((a, l) => a + (l.ok ? l.qty : 0), 0) / 5));
  const itemsSubtotal = groups.reduce((a, g) => a + g.itemsTotal, 0);
  // carrier-based central shipping (weight & city)
  const city = (opts.city ?? "").trim();
  const central = groups.find((g) => !g.sellerId);
  const carrierOpts: CarrierOption[] = [];
  let carrierId: number | null = null;
  const active = groups.length ? await activeCarriers(tx) : [];
  for (const c of active) {
    let cost = 0;
    for (const group of groups) cost += await carrierCost(tx, c, city, group.weight, group.itemsTotal);
    carrierOpts.push({ id: c.id, name: c.name, minDays: c.minDays, maxDays: c.maxDays, cost });
  }
  const chosen = carrierOpts.find((c) => c.id === opts.carrierId) ?? carrierOpts.slice().sort((a, b) => a.cost - b.cost)[0];
  if (chosen) {
    const carrier = active.find((c) => c.id === chosen.id)!;
    carrierId = carrier.id;
    for (const group of groups) group.shippingCost = await carrierCost(tx, carrier, city, group.weight, group.itemsTotal);
    if (central) central.name = `${s.senderName} — ${carrier.name}`;
  }
  const sellerShippingTotal = groups.filter((g) => g.sellerId).reduce((a, g) => a + g.shippingCost, 0);
  const centralShipping = central?.shippingCost ?? 0;
  // festival discount (platform funded)
  let festivalDiscount = 0;
  for (const l of lines) if (l.ok && l.festivalPct) festivalDiscount += Math.round((l.lineTotal * l.festivalPct) / 100);
  // discount code on post-festival amounts
  let code: Quote["code"] = null;
  let codeDiscount = 0;
  const creditCode=opts.code?.trim().toUpperCase()??"";
  const isCredit=creditCode==="WALLET"||creditCode.startsWith("GIFT-");
  if (opts.code?.trim()&&!isCredit) {
    const r = await evaluateCode(tx, opts.code, opts.userId ?? null, lines.filter((l) => l.ok).map((l) => ({ productId: l.productId, categoryId: l.categoryId, amount: l.lineTotal - Math.round((l.lineTotal * l.festivalPct) / 100) })), !!opts.lockCode);
    code = { ok: r.ok, error: r.error, code: r.code, title: r.title, codeId: r.codeId };
    if (r.ok) codeDiscount = r.amount;
  }
  if (!s.multiVendor) {
    let n = 0;
    for (const g of groupsMap.values()) { n++; if (g.sellerId) g.name = `${s.siteName} — مرسوله ${n.toLocaleString("fa-IR")}`; for (const l of g.lines) l.sellerName = s.siteName; }
  }
  const discount = festivalDiscount + codeDiscount;
  const tax = Math.round((Math.max(0, itemsSubtotal - discount) * s.taxRate) / 100);
  const gross=itemsSubtotal+sellerShippingTotal+centralShipping+tax-discount;
  let creditAmount=0,giftCardId:number|null=null;
  if(isCredit){const r=await quoteCredit(tx,creditCode,opts.userId??null,gross,!!opts.lockCode);code={ok:r.ok,error:r.error,code:creditCode,title:creditCode==="WALLET"?"کیف پول":"کارت هدیه"};if(r.ok){creditAmount=r.amount;giftCardId=r.giftCardId}}
  return {
    creditAmount,giftCardId,
    lines, groups: [...groupsMap.values()], itemsSubtotal, sellerShippingTotal, centralShipping, discount, tax,
    finalTotal: gross-creditAmount,
    valid: lines.length > 0 && lines.every((l) => l.ok), festivalDiscount, codeDiscount, code, carriers: carrierOpts, carrierId, city,
  };
}

export async function placeOrder(ctx: Ctx & { userId: number }, items: CartInput[], address: Address, idemKey: string, extra: { code?: string; carrierId?: number | null; recoveryKey?: string; officialInvoiceType?: string | null; officialInvoiceDetails?: Record<string,string> | null } = {}) {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${idemKey}))`);
    const [existing] = await tx.select().from(orders).where(eq(orders.idempotencyKey, idemKey));
    if (existing) {
      if (existing.customerId !== ctx.userId) throw new HttpError(409, "کلید تکراری");
      return { order: existing, fresh: false };
    }
    const q = await quoteCart(tx, items, true, { userId: ctx.userId, code: extra.code, city: address.city, carrierId: extra.carrierId, lockCode: true });
    if (!q.valid) throw new HttpError(409, q.lines.find((l) => !l.ok)?.error ?? "سبد نامعتبر");
    if (q.code && !q.code.ok) throw new HttpError(409, q.code.error ?? "کد تخفیف نامعتبر");
    if (q.lines.some((line) => line.ok) && (!q.carriers.length || !extra.carrierId || !q.carriers.some((carrier) => carrier.id === extra.carrierId))) throw new HttpError(409, "برای ثبت سفارش باید یک شرکت پستی فعال انتخاب کنید");
    const carrierName = q.carriers.find((c) => c.id === q.carrierId)?.name ?? null;
    const [buyer] = await tx.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, ctx.userId));
    const cartKey = `user-${ctx.userId}-${extra.recoveryKey || idemKey.replace(/[^\w-]/g, "-")}`;
    const [recovery] = await tx.insert(incompleteCarts).values({ cartKey, customerId: ctx.userId, customerName: buyer?.name ?? "مشتری", phone: buyer?.phone ?? address.phone, items: q.lines.map((line) => ({ productId: line.productId, variantId: line.variantId, offerId: line.offerId, qty: line.qty, selectedOptions: line.variantTitle, title: line.variantTitle ? `${line.title} — ${line.variantTitle}` : line.title })), reason: "سفارش ثبت شده اما پرداخت تکمیل نشده است", status: "checkout_started", updatedAt: new Date() })
      .onConflictDoUpdate({ target: incompleteCarts.cartKey, set: { customerId: ctx.userId, customerName: buyer?.name ?? "مشتری", phone: buyer?.phone ?? address.phone, items: q.lines.map((line) => ({ productId: line.productId, variantId: line.variantId, offerId: line.offerId, qty: line.qty, selectedOptions: line.variantTitle, title: line.variantTitle ? `${line.title} — ${line.variantTitle}` : line.title })), reason: "سفارش ثبت شده اما پرداخت تکمیل نشده است", status: "checkout_started", updatedAt: new Date() } }).returning({ id: incompleteCarts.id });
    const [order] = await tx.insert(orders).values({
      number: genNumber("SB"), customerId: ctx.userId, status: "pending_payment", paymentStatus: "unpaid",
      recoveryCartId: recovery.id,
      itemsSubtotal: q.itemsSubtotal, sellerShippingTotal: q.sellerShippingTotal, centralShipping: q.centralShipping,
      discount: q.discount, tax: q.tax, total: q.finalTotal, creditAmount:q.creditAmount,giftCardId:q.giftCardId,address, idempotencyKey: idemKey,
      festivalDiscount: q.festivalDiscount, codeDiscount: q.codeDiscount, discountCodeId: q.code?.ok ? q.code.codeId ?? null : null, discountCode: q.code?.ok ? q.code.code ?? null : null, carrierId: q.carrierId,
      officialInvoiceType: extra.officialInvoiceType ?? null, officialInvoiceDetails: extra.officialInvoiceDetails ?? null,
    }).returning();
    if(q.creditAmount){const [customer]=await tx.select({phone:users.phone}).from(users).where(eq(users.id,ctx.userId));await reserveCredit(tx,customer.phone,q.creditAmount,q.giftCardId,order.id,ctx.userId);}
    if (q.code?.ok && q.code.codeId) {
      await tx.update(discountCodes).set({ usedCount: sql`${discountCodes.usedCount} + 1` }).where(eq(discountCodes.id, q.code.codeId));
      await tx.insert(discountUsages).values({ codeId: q.code.codeId, userId: ctx.userId, orderId: order.id, amount: q.codeDiscount });
    }
    for (const g of q.groups) {
      const [sh] = await tx.insert(sellerShipments).values({
        orderId: order.id, sellerId: g.sellerId, itemsTotal: g.itemsTotal, shippingCost: g.shippingCost, prepDays: g.prepDays, packageCount: g.packages, weight: g.weight,
        carrierId: q.carrierId, carrier: carrierName,
      }).returning();
      for (const l of g.lines) {
        await tx.insert(orderItems).values({
          orderId: order.id, productId: l.productId, variantId: l.variantId, offerId: l.offerId, sellerId: l.sellerId, shipmentId: sh.id,
          title: l.variantTitle ? `${l.title} — ${l.variantTitle}` : l.title, unitPrice: l.unitPrice, qty: l.qty, lineTotal: l.lineTotal, unitCost: l.unitCost,
        });
        let res: unknown[] = [];
        if (l.offerId) {
          res = await tx.update(sellerOffers).set({ reserved: sql`${sellerOffers.reserved} + ${l.qty}` })
            .where(and(eq(sellerOffers.id, l.offerId), sql`${sellerOffers.stock} - ${sellerOffers.reserved} >= ${l.qty}`)).returning({ id: sellerOffers.id });
        } else if (l.variantId) {
          res = await tx.update(productVariants).set({ reserved: sql`${productVariants.reserved} + ${l.qty}` })
            .where(l.allowBackorder ? eq(productVariants.id, l.variantId) : and(eq(productVariants.id, l.variantId), sql`${productVariants.onHand} - ${productVariants.reserved} >= ${l.qty}`)).returning({ id: productVariants.id });
        } else {
          res = await tx.update(products).set({ reserved: sql`${products.reserved} + ${l.qty}` })
            .where(l.allowBackorder ? eq(products.id, l.productId) : and(eq(products.id, l.productId), sql`${products.onHand} - ${products.reserved} >= ${l.qty}`)).returning({ id: products.id });
        }
        if (res.length === 0) throw new HttpError(409, `موجودی «${l.title}» کافی نیست`);
        await tx.insert(stockMovements).values({ productId: l.productId, variantId: l.variantId, offerId: l.offerId, type: "reserve", qty: l.qty, refType: "order", refId: order.id, note: l.allowBackorder ? "فروش با تأمین پس از سفارش؛ رزرو موجودی آزاد" : null, userId: ctx.userId });
      }
      if (g.sellerId) {
        const [sel] = await tx.select().from(sellers).where(eq(sellers.id, g.sellerId));
        if (sel) await notify(tx, sel.userId, `سفارش جدید ${order.number}`, `${g.lines.length} قلم برای آماده‌سازی`, `/seller/orders/${order.id}`);
      }
    }
    const hasBackorder = q.lines.some((line) => line.allowBackorder && line.available < line.qty);
    await tx.insert(orderHistory).values({ orderId: order.id, status: "pending_payment", note: hasBackorder ? "سفارش ثبت شد؛ بخشی از کالا با تأمین پس از سفارش رزرو شد" : "سفارش ثبت شد و موجودی رزرو گردید", userId: ctx.userId });
    await audit(tx, ctx, "order.create", "order", order.id, null, { number: order.number, total: order.total, items: items.length });
    return { order, fresh: true };
  });
  if (result.fresh) {
    const [u] = await db.select().from(users).where(eq(users.id, ctx.userId));
    if (u) void sendSms("order_created", u.phone, { name: u.name, order: result.order.number });
  }
  if(result.order.total===0&&result.order.status==="pending_payment"){await payOrder(ctx,result.order.id,`credit:${result.order.id}`,false,{method:"credit"});const [paid]=await db.select().from(orders).where(eq(orders.id,result.order.id));return paid;}
  return result.order;
}

export type PayInfo = {
  method: "gateway" | "card_to_card" | "bank_transfer" | "cash" | "pos" | "credit";
  gateway?: string; authority?: string; cardMasked?: string; payerName?: string; bankName?: string; trackingCode?: string;
  paidAt?: Date; note?: string; receiptMediaId?: number | null; details?: Record<string, string>; existingPaymentId?: number;
};

export async function payOrder(ctx: Ctx & { userId: number }, orderId: number, idemKey: string, asStaff = false, info?: PayInfo) {
  const out = await db.transaction(async (tx) => {
    const [dup] = await tx.select().from(payments).where(eq(payments.idempotencyKey, idemKey));
    if (dup) return { order: null, duplicate: true };
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || (!asStaff && o.customerId !== ctx.userId)) throw new HttpError(404, "سفارش یافت نشد");
    if (o.status !== "pending_payment") throw new HttpError(400, "سفارش در وضعیت پرداخت نیست");
    const method = info?.method ?? "gateway";
    const settingsNow = await getSettings(tx);
    const base = {
      amount: o.total, method, status: "success",
      gateway: method === "gateway" ? info?.gateway ?? settingsNow.paymentGateway : null,
      authority: info?.authority ?? (method === "gateway" ? `A${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)}` : null),
      cardMasked: info?.cardMasked ?? (method === "gateway" ? `6037-99**-****-${String(1000 + Math.floor(Math.random() * 9000))}` : null),
      payerName: info?.payerName ?? null, bankName: info?.bankName ?? null, trackingCode: info?.trackingCode ?? null,
      paidAt: info?.paidAt ?? new Date(), note: info?.note ?? null, receiptMediaId: info?.receiptMediaId ?? null, details: info?.details ?? {},
      ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, recordedBy: ctx.userId,
      verifiedBy: asStaff ? ctx.userId : null, verifiedAt: asStaff ? new Date() : null,
    };
    let pay: typeof payments.$inferSelect;
    if (info?.existingPaymentId) {
      const [ex] = await tx.select().from(payments).where(and(eq(payments.id, info.existingPaymentId), eq(payments.orderId, o.id))).for("update");
      if (!ex || !["pending_verification", "initiated"].includes(ex.status)) throw new HttpError(400, "پرداخت در انتظار تأیید یافت نشد");
      if (ex.status === "initiated" && ex.amount !== o.total) throw new HttpError(409, "مبلغ پرداخت با مبلغ سفارش مغایرت دارد");
      [pay] = await tx.update(payments).set({ status: "success", amount: o.total, verifiedBy: ex.status === "initiated" ? null : ctx.userId, verifiedAt: new Date(), refCode: ex.refCode ?? `MN${Date.now()}` }).where(eq(payments.id, ex.id)).returning();
    } else {
      [pay] = await tx.insert(payments).values({ ...base, orderId: o.id, refCode: `${method === "gateway" ? "PG" : "MN"}${Date.now()}`, idempotencyKey: idemKey } as typeof payments.$inferInsert).returning();
    }
    const shipments = await tx.select().from(sellerShipments).where(eq(sellerShipments.orderId, o.id));
    const lines: Line[] = [{ code: "1101", debit: o.total, description: `دریافت وجه سفارش ${o.number}` },{code:"2103",debit:o.creditAmount,description:"مصرف کارت هدیه یا کیف پول"}];
    for (const sh of shipments) {
      if (sh.sellerId) {
        const gross = sh.itemsTotal + sh.shippingCost;
        lines.push({ code: "2101", credit: gross, detail1: `seller:${sh.sellerId}` });
        const [w] = await tx.select().from(wallets).where(eq(wallets.sellerId, sh.sellerId)).for("update");
        if (w) {
          await tx.update(wallets).set({ pendingBalance: w.pendingBalance + gross, updatedAt: new Date() }).where(eq(wallets.id, w.id));
          await tx.insert(walletTransactions).values({ walletId: w.id, type: "sale_pending", bucket: "pending", amount: gross, refType: "shipment", refId: sh.id, note: `سهم فروش سفارش ${o.number}` });
        }
      } else {
        lines.push({ code: "4101", credit: sh.itemsTotal, detail1: "central" });
        lines.push({ code: "4103", credit: sh.shippingCost });
      }
    }
    lines.push({ code: "2201", credit: o.tax });
    if (o.discount > 0) lines.push({ code: "5301", debit: o.discount, description: `تخفیف سفارش ${o.number}${o.discountCode ? ` (کد ${o.discountCode})` : ""}` });
    const entry = await postJournal(tx, `فروش سفارش ${o.number}`, lines, { type: "order", id: o.id }, ctx.userId);
    const [upd] = await tx.update(orders).set({ status: "paid", paymentStatus: "paid", paymentEntryId: entry?.id ?? null, updatedAt: new Date() }).where(eq(orders.id, o.id)).returning();
    if (o.recoveryCartId) await tx.update(incompleteCarts).set({ status: "completed", updatedAt: new Date() }).where(eq(incompleteCarts.id, o.recoveryCartId));
    const METHOD_FA: Record<string, string> = { gateway: "درگاه اینترنتی", card_to_card: "کارت به کارت", bank_transfer: "حواله بانکی", cash: "نقدی", pos: "کارتخوان" };
    await tx.insert(orderHistory).values({ orderId: o.id, status: "paid", note: `پرداخت موفق (${METHOD_FA[pay.method] ?? pay.method}) - کد ${pay.refCode}${pay.trackingCode ? ` - پیگیری ${pay.trackingCode}` : ""}`, userId: ctx.userId });
    await audit(tx, ctx, "payment.success", "order", o.id, { status: o.status }, { status: "paid", amount: o.total, payment: pay.id });
    const [buyer] = await tx.select({ id: users.id, referredById: users.referredById }).from(users).where(eq(users.id, o.customerId));
    const purchasedItems = await tx.select({ variantId: orderItems.variantId, qty: orderItems.qty, title: orderItems.title }).from(orderItems).where(eq(orderItems.orderId, o.id));
    const variantIds = purchasedItems.map((item) => item.variantId).filter((id): id is number => id !== null);
    const rewardVariants = variantIds.length ? await tx.select({ id: productVariants.id, rewardPoints: productVariants.rewardPoints }).from(productVariants).where(inArray(productVariants.id, variantIds)) : [];
    const rewardByVariant = new Map(rewardVariants.map((v) => [v.id, v.rewardPoints]));
    const earned = purchasedItems.reduce((sum, item) => sum + (item.variantId ? (rewardByVariant.get(item.variantId) ?? 0) * item.qty : 0), 0);
    if (earned > 0) {
      await tx.insert(loyaltyPointEntries).values({ userId: o.customerId, kind: "purchase", points: earned, orderId: o.id, reference: `purchase:${o.id}`, description: `امتیاز خرید سفارش ${o.number}` }).onConflictDoNothing();
      await tx.update(users).set({ marketingPoints: sql`${users.marketingPoints}+${earned}` }).where(eq(users.id, o.customerId));
    }
    if (buyer?.referredById) {
      const points = Math.floor((o.total * 0.05) / 1000);
      if (points > 0) {
        const [award] = await tx.insert(referralAwards).values({ orderId: o.id, buyerId: buyer.id, referrerId: buyer.referredById, points }).onConflictDoNothing().returning({ id: referralAwards.id });
        if (award) {
          await tx.update(users).set({ marketingPoints: sql`${users.marketingPoints}+${points}` }).where(eq(users.id, buyer.referredById));
          await tx.insert(loyaltyPointEntries).values({ userId: buyer.referredById, kind: "referral", points, orderId: o.id, reference: `referral:${o.id}`, description: `امتیاز معرفی از سفارش ${o.number}` }).onConflictDoNothing();
        }
      }
    }
    return { order: upd, duplicate: false };
  });
  if (out.order) {
    const [u] = await db.select().from(users).where(eq(users.id, out.order.customerId));
    if (u) void sendSms("payment_success", u.phone, { order: out.order.number, amount: out.order.total });
  }
  return out;
}

async function releaseShipmentFunds(tx: DB, ctx: Ctx, shId: number) {
  const [sh] = await tx.select().from(sellerShipments).where(eq(sellerShipments.id, shId)).for("update");
  if (!sh || !sh.sellerId || sh.settled) return;
  const [sel] = await tx.select().from(sellers).where(eq(sellers.id, sh.sellerId));
  const gross = sh.itemsTotal + sh.shippingCost;
  const commission = Math.round((sh.itemsTotal * (sel?.commissionRate ?? 0)) / 100);
  const net = gross - commission - sh.deductions;
  const [w] = await tx.select().from(wallets).where(eq(wallets.sellerId, sh.sellerId)).for("update");
  if (!w) return;
  await tx.update(wallets).set({ pendingBalance: w.pendingBalance - gross, availableBalance: w.availableBalance + net, updatedAt: new Date() }).where(eq(wallets.id, w.id));
  await tx.insert(walletTransactions).values([
    { walletId: w.id, type: "release", bucket: "pending", amount: -gross, refType: "shipment", refId: sh.id, note: "آزادسازی پس از تحویل" },
    { walletId: w.id, type: "release", bucket: "available", amount: net, refType: "shipment", refId: sh.id, note: `خالص پس از کسر کمیسیون ${commission.toLocaleString()}` },
  ]);
  await postJournal(tx, `تسویه مرسوله #${sh.id} فروشنده ${sel?.shopName ?? ""}`, [
    { code: "2101", debit: gross, detail1: `seller:${sh.sellerId}` },
    { code: "2102", credit: net, detail1: `seller:${sh.sellerId}` },
    { code: "4102", credit: commission + sh.deductions, detail1: `seller:${sh.sellerId}` },
  ], { type: "shipment", id: sh.id }, ctx.userId);
  await tx.update(sellerShipments).set({ settled: true, commission }).where(eq(sellerShipments.id, sh.id));
  await audit(tx, ctx, "wallet.release", "wallet", w.id, { pending: w.pendingBalance, available: w.availableBalance }, { gross, commission, net });
}

async function refreshOrderStatus(tx: DB, ctx: Ctx, orderId: number) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
  const shs = (await tx.select().from(sellerShipments).where(eq(sellerShipments.orderId, orderId))).filter((s) => s.status !== "cancelled");
  let status = o.status;
  if (shs.length && shs.every((s) => s.status === "delivered")) status = "completed";
  else if (shs.length && shs.every((s) => s.status === "shipped" || s.status === "delivered")) status = "shipped";
  else if (shs.some((s) => s.status !== "pending")) status = "processing";
  if (status !== o.status) {
    await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.insert(orderHistory).values({ orderId, status, note: "به‌روزرسانی خودکار بر اساس وضعیت مرسوله‌ها", userId: ctx.userId });
    await audit(tx, ctx, "order.status", "order", orderId, { status: o.status }, { status });
  }
  return status;
}

const NEXT: Record<string, string[]> = { pending: ["preparing", "cancelled"], preparing: ["ready"], ready: ["shipped"], shipped: ["delivered", "returned"] };

export async function updateShipment(
  ctx: Ctx & { userId: number }, shipmentId: number,
  input: { status: string; carrier?: string; carrierId?: number | null; trackingNumber?: string; packageCount?: number; notes?: string; shippedAt?: Date },
  scope: { sellerId: number | null; staff: boolean },
) {
  let smsEvt: { event: string; orderId: number; tracking?: string } | null = null;
  const res = await db.transaction(async (tx) => {
    const [sh] = await tx.select().from(sellerShipments).where(eq(sellerShipments.id, shipmentId)).for("update");
    if (!sh) throw new HttpError(404, "مرسوله یافت نشد");
    if (!scope.staff && (scope.sellerId === null || sh.sellerId !== scope.sellerId)) throw new HttpError(404, "مرسوله یافت نشد");
    const [o] = await tx.select().from(orders).where(eq(orders.id, sh.orderId)).for("update");
    if (!["paid", "processing", "shipped"].includes(o.status)) throw new HttpError(400, "سفارش هنوز پرداخت نشده یا بسته است");
    if (!(NEXT[sh.status] ?? []).includes(input.status)) throw new HttpError(400, "انتقال وضعیت مجاز نیست");
    if (input.status === "cancelled") throw new HttpError(400, "لغو مرسوله از طریق لغو سفارش انجام می‌شود");
    if (input.status === "delivered" && !scope.staff) throw new HttpError(403, "تحویل توسط مشتری یا مدیر تأیید می‌شود");
    const patch: Partial<typeof sellerShipments.$inferInsert> = { status: input.status, notes: input.notes ?? sh.notes };
    if (input.status === "preparing") patch.preparedAt = new Date();
    if (input.status === "ready") { patch.packageCount = Math.max(1, Math.min(50, input.packageCount ?? sh.packageCount)); smsEvt = { event: "ready_to_ship", orderId: o.id }; }
    if (input.status === "shipped") {
      let carrierName = input.carrier;
      if (input.carrierId) {
        const [c] = await tx.select().from(carriers).where(eq(carriers.id, input.carrierId));
        if (!c) throw new HttpError(400, "شرکت پستی نامعتبر");
        carrierName = c.name; patch.carrierId = c.id;
      }
      if (!carrierName || !input.trackingNumber) throw new HttpError(400, "شرکت حمل و کد رهگیری الزامی است");
      patch.carrier = carrierName; patch.trackingNumber = input.trackingNumber; patch.shippedAt = input.shippedAt ?? new Date();
      await deductStock(tx, ctx, sh.id, o.id, o.number);
      smsEvt = { event: "order_shipped", orderId: o.id, tracking: input.trackingNumber };
    }
    if (input.status === "delivered") patch.deliveredAt = new Date();
    await tx.update(sellerShipments).set(patch).where(eq(sellerShipments.id, sh.id));
    if (input.status === "delivered") await releaseShipmentFunds(tx, ctx, sh.id);
    await tx.insert(orderHistory).values({ orderId: o.id, status: `shipment:${input.status}`, note: `مرسوله #${sh.id}${input.trackingNumber ? ` - رهگیری ${input.trackingNumber}` : ""}`, userId: ctx.userId });
    await audit(tx, ctx, "shipment.update", "shipment", sh.id, { status: sh.status }, patch);
    const st = await refreshOrderStatus(tx, ctx, o.id);
    return { orderStatus: st, customerId: o.customerId, number: o.number };
  });
  const evt = smsEvt as { event: string; orderId: number; tracking?: string } | null;
  if (evt) {
    const [u] = await db.select().from(users).where(eq(users.id, res.customerId));
    if (u) void sendSms(evt.event, u.phone, { order: res.number, tracking: evt.tracking ?? "" });
  }
  return res;
}

async function deductStock(tx: DB, ctx: Ctx, shipmentId: number, orderId: number, orderNumber: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.shipmentId, shipmentId));
  let cogs = 0;
  for (const it of items) {
    let saleUnitCost = it.unitCost;
    if (it.offerId) {
      const r = await tx.update(sellerOffers).set({ stock: sql`${sellerOffers.stock} - ${it.qty}`, reserved: sql`${sellerOffers.reserved} - ${it.qty}`, updatedAt: new Date() })
        .where(and(eq(sellerOffers.id, it.offerId), sql`${sellerOffers.reserved} >= ${it.qty}`, sql`${sellerOffers.stock} >= ${it.qty}`)).returning({ id: sellerOffers.id });
      if (!r.length) throw new HttpError(409, "ناسازگاری موجودی فروشنده");
    } else {
      const [p] = await tx.select().from(products).where(eq(products.id, it.productId)).for("update");
      if (it.variantId) {
        const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, it.variantId)).for("update");
        if (!v) throw new HttpError(409, "تنوع سفارش یافت نشد");
        saleUnitCost = v.costPrice ?? p.avgCost;
        if (p.allowBackorder) {
          const otherReserved = Math.max(0, v.reserved - it.qty);
          const availableForThisOrder = Math.max(0, v.onHand - otherReserved);
          const receiptQty = Math.max(0, it.qty - availableForThisOrder);
          if (receiptQty > 0) {
            await tx.update(productVariants).set({ onHand: sql`${productVariants.onHand} + ${receiptQty}` }).where(eq(productVariants.id, v.id));
            await tx.insert(stockMovements).values({ productId: it.productId, variantId: it.variantId, type: "backorder_receive", qty: receiptQty, unitCost: saleUnitCost, refType: "shipment", refId: shipmentId, note: `ورود کسری برای ارسال سفارش ${orderNumber}`, userId: ctx.userId });
          }
        }
        const r = await tx.update(productVariants).set({ onHand: sql`${productVariants.onHand} - ${it.qty}`, reserved: sql`${productVariants.reserved} - ${it.qty}` })
          .where(and(eq(productVariants.id, it.variantId), sql`${productVariants.reserved} >= ${it.qty}`)).returning({ id: productVariants.id });
        if (!r.length) throw new HttpError(409, "ناسازگاری موجودی تنوع");
      } else {
        saleUnitCost = p.avgCost;
        if (p.allowBackorder) {
          const otherReserved = Math.max(0, p.reserved - it.qty);
          const availableForThisOrder = Math.max(0, p.onHand - otherReserved);
          const receiptQty = Math.max(0, it.qty - availableForThisOrder);
          if (receiptQty > 0) {
            await tx.update(products).set({ onHand: sql`${products.onHand} + ${receiptQty}` }).where(eq(products.id, p.id));
            await tx.insert(stockMovements).values({ productId: it.productId, type: "backorder_receive", qty: receiptQty, unitCost: saleUnitCost, refType: "shipment", refId: shipmentId, note: `ورود کسری برای ارسال سفارش ${orderNumber}`, userId: ctx.userId });
          }
        }
        const r = await tx.update(products).set({ onHand: sql`${products.onHand} - ${it.qty}`, reserved: sql`${products.reserved} - ${it.qty}` })
          .where(and(eq(products.id, it.productId), sql`${products.reserved} >= ${it.qty}`)).returning({ id: products.id });
        if (!r.length) throw new HttpError(409, "ناسازگاری موجودی مرکزی");
      }
      cogs += saleUnitCost * it.qty;
      await tx.update(orderItems).set({ unitCost: saleUnitCost }).where(eq(orderItems.id, it.id));
    }
    await tx.insert(stockMovements).values({ productId: it.productId, variantId: it.variantId, offerId: it.offerId, type: "sale_out", qty: -it.qty, unitCost: saleUnitCost, refType: "order", refId: orderId, userId: ctx.userId });
  }
  if (cogs > 0) await postJournal(tx, `بهای تمام‌شده سفارش ${orderNumber}`, [{ code: "5101", debit: cogs }, { code: "1201", credit: cogs }], { type: "order", id: orderId }, ctx.userId);
}

/** Edit carrier / tracking / ship date / notes without changing status (staff or owning seller). */
export async function editShipmentInfo(ctx: Ctx & { userId: number }, shipmentId: number, input: { carrierId?: number | null; trackingNumber?: string; shippedAt?: Date; notes?: string }, scope: { sellerId: number | null; staff: boolean }) {
  return db.transaction(async (tx) => {
    const [sh] = await tx.select().from(sellerShipments).where(eq(sellerShipments.id, shipmentId)).for("update");
    if (!sh || (!scope.staff && sh.sellerId !== scope.sellerId)) throw new HttpError(404, "مرسوله یافت نشد");
    if (["cancelled", "returned"].includes(sh.status)) throw new HttpError(400, "مرسوله بسته شده است");
    const patch: Partial<typeof sellerShipments.$inferInsert> = {};
    if (input.carrierId) {
      const [c] = await tx.select().from(carriers).where(eq(carriers.id, input.carrierId));
      if (!c) throw new HttpError(400, "شرکت پستی نامعتبر");
      patch.carrierId = c.id; patch.carrier = c.name;
    }
    if (input.trackingNumber !== undefined) patch.trackingNumber = input.trackingNumber || null;
    if (input.shippedAt) { if (!["shipped", "delivered"].includes(sh.status)) throw new HttpError(400, "تاریخ ارسال فقط برای مرسوله ارسال‌شده قابل ثبت است"); patch.shippedAt = input.shippedAt; }
    if (input.notes !== undefined) patch.notes = input.notes || null;
    await tx.update(sellerShipments).set(patch).where(eq(sellerShipments.id, sh.id));
    await tx.insert(orderHistory).values({ orderId: sh.orderId, status: "shipment:info", note: `ویرایش اطلاعات مرسوله #${sh.id}${patch.trackingNumber ? ` - رهگیری ${patch.trackingNumber}` : ""}${input.notes ? ` - ${input.notes}` : ""}`, userId: ctx.userId });
    await audit(tx, ctx, "shipment.edit_info", "shipment", sh.id, { carrier: sh.carrier, trackingNumber: sh.trackingNumber, shippedAt: sh.shippedAt, notes: sh.notes }, patch);
    return { ok: true };
  });
}

/** Customer submits a card-to-card / transfer receipt; order waits for staff verification. */
export async function submitManualPayment(ctx: Ctx & { userId: number }, orderId: number, info: PayInfo, idemKey: string) {
  return db.transaction(async (tx) => {
    const [dup] = await tx.select().from(payments).where(eq(payments.idempotencyKey, idemKey));
    if (dup) return dup;
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || o.customerId !== ctx.userId) throw new HttpError(404, "سفارش یافت نشد");
    if (o.status !== "pending_payment") throw new HttpError(400, "سفارش در وضعیت پرداخت نیست");
    const [pending] = await tx.select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "pending_verification")));
    if (pending) throw new HttpError(400, "یک پرداخت در انتظار تأیید برای این سفارش ثبت شده است");
    const [pay] = await tx.insert(payments).values({
      orderId: o.id, amount: o.total, method: info.method, status: "pending_verification", payerName: info.payerName ?? null, cardMasked: info.cardMasked ?? null,
      bankName: info.bankName ?? null, trackingCode: info.trackingCode ?? null, paidAt: info.paidAt ?? new Date(), note: info.note ?? null, receiptMediaId: info.receiptMediaId ?? null,
      ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null, recordedBy: ctx.userId, refCode: `MN${Date.now()}`, idempotencyKey: idemKey,
    }).returning();
    await tx.update(orders).set({ paymentStatus: "pending_verification", updatedAt: new Date() }).where(eq(orders.id, o.id));
    await tx.insert(orderHistory).values({ orderId: o.id, status: "pending_verification", note: `ثبت فیش ${info.method === "card_to_card" ? "کارت به کارت" : "حواله"} - پیگیری ${info.trackingCode ?? "—"}`, userId: ctx.userId });
    await audit(tx, ctx, "payment.submit_manual", "order", o.id, null, { paymentId: pay.id, method: info.method, trackingCode: info.trackingCode });
    return pay;
  });
}

export async function rejectManualPayment(ctx: Ctx & { userId: number }, paymentId: number, reason: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.status !== "pending_verification" || !p.orderId) throw new HttpError(400, "پرداخت در انتظار تأیید یافت نشد");
    await tx.update(payments).set({ status: "rejected", note: [p.note, `رد: ${reason}`].filter(Boolean).join(" | "), verifiedBy: ctx.userId, verifiedAt: new Date() }).where(eq(payments.id, p.id));
    await tx.update(orders).set({ paymentStatus: "unpaid", updatedAt: new Date() }).where(eq(orders.id, p.orderId));
    await tx.insert(orderHistory).values({ orderId: p.orderId, status: "payment_rejected", note: `فیش پرداخت رد شد: ${reason}`, userId: ctx.userId });
    const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId));
    await notify(tx, o.customerId, `فیش پرداخت سفارش ${o.number} تأیید نشد`, reason, `/customer/orders/${o.id}`);
    await audit(tx, ctx, "payment.reject", "payment", p.id, { status: p.status }, { status: "rejected", reason });
  });
}

export async function confirmReceipt(ctx: Ctx & { userId: number }, orderId: number) {
  const res = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || o.customerId !== ctx.userId) throw new HttpError(404, "سفارش یافت نشد");
    const shs = (await tx.select().from(sellerShipments).where(eq(sellerShipments.orderId, o.id))).filter((s) => s.status !== "cancelled");
    if (!shs.length || !shs.every((s) => s.status === "shipped" || s.status === "delivered")) throw new HttpError(400, "تمام مرسوله‌ها هنوز ارسال نشده‌اند");
    for (const s of shs) {
      if (s.status === "shipped") {
        await tx.update(sellerShipments).set({ status: "delivered", deliveredAt: new Date() }).where(eq(sellerShipments.id, s.id));
        await releaseShipmentFunds(tx, ctx, s.id);
      }
    }
    await tx.update(orders).set({ customerConfirmedAt: new Date(), status: "completed", updatedAt: new Date() }).where(eq(orders.id, o.id));
    await tx.insert(orderHistory).values({ orderId: o.id, status: "completed", note: "دریافت کامل سفارش توسط مشتری تأیید شد", userId: ctx.userId });
    await audit(tx, ctx, "order.confirm_receipt", "order", o.id, { status: o.status }, { status: "completed" });
    return o;
  });
  const [u] = await db.select().from(users).where(eq(users.id, res.customerId));
  if (u) void sendSms("order_delivered", u.phone, { order: res.number });
}

export async function cancelOrder(ctx: Ctx & { userId: number }, orderId: number, scope: { staff: boolean }, reason: string) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || (!scope.staff && o.customerId !== ctx.userId)) throw new HttpError(404, "سفارش یافت نشد");
    if (!["pending_payment", "paid"].includes(o.status)) throw new HttpError(400, "این سفارش قابل لغو نیست (پردازش آغاز شده)");
    const shs = await tx.select().from(sellerShipments).where(and(eq(sellerShipments.orderId, o.id), ne(sellerShipments.status, "cancelled")));
    if (shs.some((s) => !["pending", "preparing"].includes(s.status))) throw new HttpError(400, "بخشی از سفارش ارسال شده است");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    for (const it of items) {
      if (it.offerId) await tx.update(sellerOffers).set({ reserved: sql`greatest(${sellerOffers.reserved} - ${it.qty}, 0)` }).where(eq(sellerOffers.id, it.offerId));
      else if (it.variantId) await tx.update(productVariants).set({ reserved: sql`greatest(${productVariants.reserved} - ${it.qty}, 0)` }).where(eq(productVariants.id, it.variantId));
      else await tx.update(products).set({ reserved: sql`greatest(${products.reserved} - ${it.qty}, 0)` }).where(eq(products.id, it.productId));
      await tx.insert(stockMovements).values({ productId: it.productId, variantId: it.variantId, offerId: it.offerId, type: "release", qty: it.qty, refType: "order", refId: o.id, userId: ctx.userId, note: "لغو سفارش" });
    }
    if (o.paymentStatus === "paid") {
      if (o.paymentEntryId) await reverseJournal(tx, o.paymentEntryId, `لغو سفارش ${o.number}`, ctx.userId);
      for (const sh of shs.filter((s) => s.sellerId)) {
        const gross = sh.itemsTotal + sh.shippingCost;
        const [w] = await tx.select().from(wallets).where(eq(wallets.sellerId, sh.sellerId!)).for("update");
        if (w) {
          await tx.update(wallets).set({ pendingBalance: w.pendingBalance - gross }).where(eq(wallets.id, w.id));
          await tx.insert(walletTransactions).values({ walletId: w.id, type: "cancel", bucket: "pending", amount: -gross, refType: "shipment", refId: sh.id, note: "لغو سفارش" });
        }
      }
      await tx.update(payments).set({ status: "refunded" }).where(eq(payments.orderId, o.id));
    }
    if(o.creditAmount){const [customer]=await tx.select({phone:users.phone}).from(users).where(eq(users.id,o.customerId));await restoreCredit(tx,customer.phone,o.creditAmount,o.giftCardId,o.id,o.customerId);}
    if (o.discountCodeId) {
      await tx.update(discountCodes).set({ usedCount: sql`greatest(${discountCodes.usedCount} - 1, 0)` }).where(eq(discountCodes.id, o.discountCodeId));
      await tx.delete(discountUsages).where(eq(discountUsages.orderId, o.id));
    }
    if (shs.length) await tx.update(sellerShipments).set({ status: "cancelled" }).where(inArray(sellerShipments.id, shs.map((s) => s.id)));
    await tx.update(orders).set({ status: "cancelled", paymentStatus: o.paymentStatus === "paid" ? "refunded" : o.paymentStatus, updatedAt: new Date() }).where(eq(orders.id, o.id));
    await tx.insert(orderHistory).values({ orderId: o.id, status: "cancelled", note: reason || "لغو سفارش", userId: ctx.userId });
    await audit(tx, ctx, "order.cancel", "order", o.id, { status: o.status }, { status: "cancelled", reason });
  });
}

let lastExpiry = 0;
/** Releases stock of unpaid orders older than the configured window (throttled to once a minute). */
export async function expireStaleOrders(force = false) {
  if (!force && Date.now() - lastExpiry < 60_000) return 0;
  lastExpiry = Date.now();
  const s = await getSettings();
  const minutes = Number(s.orderExpiryMinutes) || 0;
  if (minutes <= 0) return 0;
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await db.select().from(orders).where(and(eq(orders.status, "pending_payment"), eq(orders.paymentStatus, "unpaid"), sql`${orders.createdAt} < ${cutoff}`)).limit(50);
  let n = 0;
  for (const o of stale) {
    const live = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "initiated"), sql`${payments.createdAt} > now() - interval '30 minutes'`));
    if (live.length) continue;
    try { await cancelOrder({ userId: o.customerId, ip: "system", ua: "expiry" }, o.id, { staff: true }, `لغو خودکار: عدم پرداخت ظرف ${minutes} دقیقه`); n++; } catch { /* ignore */ }
  }
  return n;
}
