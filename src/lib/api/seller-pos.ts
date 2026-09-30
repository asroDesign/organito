import { randomBytes } from "crypto";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, sellerLoyaltyClubs, sellerLoyaltyMembers, sellerLoyaltyRewards, sellerOffers, sellerPosItems, sellerPosSales, sellerSmsSettings, sellers, smsLogs, stockMovements, posTerminals } from "@/db/schema";
import { requireApi, rateLimit } from "../auth";
import { audit } from "../audit";
import { sendSellerClubSms } from "../sms";
import { assertSellerAllowed } from "../services/kyc";
import { genNumber, HttpError, int, str } from "../util";
import { body, type Route } from "./router";

const phoneValue = (value: unknown) => str(value, 20).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "").replace(/^98/, "0").replace(/^9/, "09");

async function sellerUser() {
  const user = await requireApi();
  if (!user.sellerId || user.sellerStatus !== "approved") throw new HttpError(403, "این بخش برای تأمین‌کنندگان تأییدشده است");
  return { user, sellerId: user.sellerId };
}

async function ensureClub(sellerId: number) {
  const [seller] = await db.select({ shopName: sellers.shopName }).from(sellers).where(eq(sellers.id, sellerId));
  if (!seller) throw new HttpError(404, "تأمین‌کننده یافت نشد");
  await db.insert(sellerLoyaltyClubs).values({ sellerId, name: `باشگاه مشتریان ${seller.shopName}` }).onConflictDoNothing();
  const [club] = await db.select().from(sellerLoyaltyClubs).where(eq(sellerLoyaltyClubs.sellerId, sellerId));
  return { club, shopName: seller.shopName };
}

export const sellerPosRoutes: Route[] = [
  { method:"GET", pattern:"seller/pos/terminals", handler:async()=>{const {sellerId}=await sellerUser();return db.select().from(posTerminals).where(and(eq(posTerminals.sellerId,sellerId),eq(posTerminals.enabled,true))).orderBy(posTerminals.name)}},
  { method:"GET", pattern:"seller/loyalty/terminals", handler:async()=>{const {sellerId}=await sellerUser();return db.select().from(posTerminals).where(eq(posTerminals.sellerId,sellerId)).orderBy(posTerminals.id)}},
  { method:"POST", pattern:"seller/loyalty/terminals", handler:async(req,_p,meta)=>{const {user,sellerId}=await sellerUser(),b=await body(req),name=str(b.name,80);if(!name)throw new HttpError(400,"نام کارتخوان الزامی است");const [row]=await db.insert(posTerminals).values({sellerId,name,bankName:str(b.bankName,80)||null,terminalCode:str(b.terminalCode,80)||null,enabled:b.enabled!==false}).returning();await audit(db,{userId:user.id,...meta},"seller.pos_terminal.create","pos_terminal",row.id,null,row);return row}},
  { method:"PUT", pattern:"seller/loyalty/terminals/:id", handler:async(req,p,meta)=>{const {user,sellerId}=await sellerUser(),id=int(p.id,1),b=await body(req),name=str(b.name,80);if(!name)throw new HttpError(400,"نام کارتخوان الزامی است");const [row]=await db.update(posTerminals).set({name,bankName:str(b.bankName,80)||null,terminalCode:str(b.terminalCode,80)||null,enabled:b.enabled===true,updatedAt:new Date()}).where(and(eq(posTerminals.id,id),eq(posTerminals.sellerId,sellerId))).returning();if(!row)throw new HttpError(404,"کارتخوان یافت نشد");await audit(db,{userId:user.id,...meta},"seller.pos_terminal.update","pos_terminal",id,null,row);return row}},
  { method:"DELETE", pattern:"seller/loyalty/terminals/:id", handler:async(_req,p,meta)=>{const {user,sellerId}=await sellerUser(),id=int(p.id,1);const [row]=await db.delete(posTerminals).where(and(eq(posTerminals.id,id),eq(posTerminals.sellerId,sellerId))).returning();if(!row)throw new HttpError(404,"کارتخوان یافت نشد");await audit(db,{userId:user.id,...meta},"seller.pos_terminal.delete","pos_terminal",id,row,null);return{ok:true}}},
  { method: "GET", pattern: "seller/pos/products", handler: async () => {
    const { sellerId } = await sellerUser();
    const rows = await db.select({ offer: sellerOffers, product: products }).from(sellerOffers)
      .innerJoin(products, eq(products.id, sellerOffers.productId))
      .where(and(eq(sellerOffers.sellerId, sellerId), eq(sellerOffers.status, "approved"), eq(products.status, "active")))
      .orderBy(products.nameFa);
    return rows.map(({ offer, product }) => ({ offerId: offer.id, productId: product.id, name: product.nameFa, brand: product.brand, sku: product.sku, price: offer.salePrice ?? offer.price, cost: offer.costPrice, stock: Math.max(0, offer.stock - offer.reserved) }));
  } },
  { method: "GET", pattern: "seller/pos/recent", handler: async () => {
    const { sellerId } = await sellerUser();
    const sales = await db.select().from(sellerPosSales).where(eq(sellerPosSales.sellerId, sellerId)).orderBy(desc(sellerPosSales.createdAt)).limit(12);
    return Promise.all(sales.map(async (sale) => ({ ...sale, items: await db.select().from(sellerPosItems).where(eq(sellerPosItems.saleId, sale.id)) })));
  } },
  { method: "POST", pattern: "seller/pos", handler: async (req, _p, meta) => {
    const { user, sellerId } = await sellerUser();
    await assertSellerAllowed(sellerId, "ثبت فروش حضوری");
    rateLimit(`seller-pos:${sellerId}`, 60, 60_000);
    const b = await body(req);
    const key = str(b.idempotencyKey, 100);
    if (key.length < 8) throw new HttpError(400, "شناسه یکتای فروش نامعتبر است");
    const phone = phoneValue(b.phone);
    if (!/^09\d{9}$/.test(phone)) throw new HttpError(400, "شماره همراه معتبر مشتری را وارد کنید");
    const customerName = str(b.customerName, 100) || "مشتری حضوری";
    const birthText = str(b.birthdate, 10);
    const birthdate = birthText ? new Date(`${birthText}T12:00:00.000Z`) : null;
    if (birthText && (!/^\d{4}-\d{2}-\d{2}$/.test(birthText) || Number.isNaN(birthdate?.getTime()))) throw new HttpError(400, "تاریخ تولد معتبر نیست");
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 80) throw new HttpError(400, "سبد فروش خالی یا نامعتبر است");
    const items = new Map<number, number>();
    for (const raw of b.items as Record<string, unknown>[]) {
      const offerId = int(raw.offerId, 1), qty = int(raw.qty, 1, 10000);
      const nextQty = (items.get(offerId) ?? 0) + qty;
      if (nextQty > 10000) throw new HttpError(400, "تعداد هر محصول حداکثر ۱۰٬۰۰۰ عدد است");
      items.set(offerId, nextQty);
    }
    const percent = int(b.discountPercent ?? 0, 0, 90);
    const rewardCode = str(b.rewardCode, 40).trim().toUpperCase();
    const cash = int((b.settlement as Record<string, unknown> | undefined)?.cash ?? 0);
    const card = int((b.settlement as Record<string, unknown> | undefined)?.card ?? 0);
    const method = ["cash", "card", "mixed"].includes(str(b.paymentMethod, 10)) ? str(b.paymentMethod, 10) : "";
    const terminalId = card > 0 ? int(b.terminalId, 1) : null;
    const [existing] = await db.select().from(sellerPosSales).where(and(eq(sellerPosSales.sellerId, sellerId), eq(sellerPosSales.idempotencyKey, key)));
    if (existing) return { ok: true, id: existing.id, number: existing.number, total: existing.total, repeated: true };
    const requested = [...items.keys()];
    const { club, shopName } = await ensureClub(sellerId);
    const sale = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const [duplicate]=await tx.select().from(sellerPosSales).where(eq(sellerPosSales.idempotencyKey,key));
      if(duplicate){if(duplicate.sellerId!==sellerId)throw new HttpError(409,"شناسه تکراری");const [reward]=await tx.select().from(sellerLoyaltyRewards).where(and(eq(sellerLoyaltyRewards.saleId,duplicate.id),eq(sellerLoyaltyRewards.sellerId,sellerId)));return {...duplicate,rewardCode:reward?.code??null,repeated:true};}
      const rows = await tx.select({ offer: sellerOffers, product: products }).from(sellerOffers)
        .innerJoin(products, eq(products.id, sellerOffers.productId))
        .where(and(inArray(sellerOffers.id, requested), eq(sellerOffers.sellerId, sellerId), eq(sellerOffers.status, "approved"), eq(products.status, "active")))
        .for("update");
      if (rows.length !== requested.length) throw new HttpError(400, "یکی از کالاها دیگر در فهرست فروش شما نیست");
      const normalized = rows.map(({ offer, product }) => ({ offer, product, qty: items.get(offer.id)! }));
      for (const row of normalized) if (row.offer.stock - row.offer.reserved < row.qty) throw new HttpError(409, `موجودی «${row.product.nameFa}» کافی نیست؛ موجودی آزاد ${row.offer.stock - row.offer.reserved}`);
      const subtotal = normalized.reduce((sum, x) => sum + (x.offer.salePrice ?? x.offer.price) * x.qty, 0);
      if (!Number.isSafeInteger(subtotal)) throw new HttpError(400, "مبلغ فاکتور بیش از حد مجاز است");
      let appliedPercent = percent;
      let reward: typeof sellerLoyaltyRewards.$inferSelect | null = null;
      if (rewardCode) {
        [reward] = await tx.select().from(sellerLoyaltyRewards).where(and(eq(sellerLoyaltyRewards.sellerId, sellerId), eq(sellerLoyaltyRewards.code, rewardCode), isNull(sellerLoyaltyRewards.redeemedAt), gt(sellerLoyaltyRewards.expiresAt, new Date()))).for("update");
        if (!reward || reward.memberPhone !== phone) throw new HttpError(400, "کد باشگاه برای این مشتری معتبر نیست یا منقضی شده است");
        if (subtotal < reward.minSubtotal) throw new HttpError(400, `حداقل خرید برای این کد ${reward.minSubtotal.toLocaleString("fa-IR")} تومان است`);
        appliedPercent = reward.discountPercent;
      }
      for (const row of normalized) {
        const price = row.offer.salePrice ?? row.offer.price;
        const max = Math.max(0, Math.floor(((price - row.offer.costPrice) * 100) / price));
        if (appliedPercent > max) throw new HttpError(400, `حداکثر تخفیف مجاز برای «${row.product.nameFa}» ${max.toLocaleString("fa-IR")}٪ است؛ قیمت فروش نباید از قیمت خرید کمتر شود`);
      }
      const discount = Math.floor(subtotal * appliedPercent / 100), total = subtotal - discount;
      const minimumTotal = normalized.reduce((sum, row) => sum + Number(row.offer.costPrice ?? 0) * row.qty, 0);
      if (total < minimumTotal) throw new HttpError(400, `مبلغ نهایی فاکتور نباید از بهای خرید کالاها (${minimumTotal.toLocaleString("fa-IR")} تومان) کمتر باشد`);
      if (!method || cash + card !== total || (method === "cash" && (cash !== total || card !== 0)) || (method === "card" && (card !== total || cash !== 0)) || (method === "mixed" && (!cash || !card))) {
        throw new HttpError(400, `جمع تسویه نقدی و کارتی باید دقیقاً ${total.toLocaleString("fa-IR")} تومان باشد`);
      }
      if (card > 0) { const [terminal] = await tx.select().from(posTerminals).where(and(eq(posTerminals.id, terminalId!), eq(posTerminals.sellerId, sellerId), eq(posTerminals.enabled, true))); if (!terminal) throw new HttpError(400, "کارتخوان فعال فروشگاه را انتخاب کنید"); }
      const number = genNumber("POS");
      const [createdSale] = await tx.insert(sellerPosSales).values({ number, idempotencyKey: key, terminalId, sellerId, createdBy: user.id, customerName, customerPhone: phone, subtotal, discount, total, paymentMethod: method, settlement: { cash, card } }).returning();
      if (reward) await tx.update(sellerLoyaltyRewards).set({ redeemedAt: new Date() }).where(eq(sellerLoyaltyRewards.id, reward.id));
      for (const row of normalized) {
        const [updated] = await tx.update(sellerOffers).set({ stock: sql`${sellerOffers.stock} - ${row.qty}`, updatedAt: new Date() })
          .where(and(eq(sellerOffers.id, row.offer.id), eq(sellerOffers.sellerId, sellerId), eq(sellerOffers.status, "approved"), sql`${sellerOffers.stock} - ${sellerOffers.reserved} >= ${row.qty}`)).returning({ id: sellerOffers.id });
        if (!updated) throw new HttpError(409, `موجودی «${row.product.nameFa}» هم‌زمان تغییر کرد؛ فاکتور دوباره ثبت نشد`);
        const lineTotal = (row.offer.salePrice ?? row.offer.price) * row.qty;
        await tx.insert(sellerPosItems).values({ saleId: createdSale.id, sellerId, offerId: row.offer.id, productId: row.product.id, title: row.product.nameFa, quantity: row.qty, unitPrice: row.offer.salePrice ?? row.offer.price, unitCost: row.offer.costPrice, lineTotal });
        await tx.insert(stockMovements).values({ productId: row.product.id, offerId: row.offer.id, type: "pos_sale", qty: -row.qty, unitCost: row.offer.costPrice, refType: "seller_pos_sale", refId: createdSale.id, note: `فروش حضوری تأمین‌کننده ${number} · بدون کمیسیون`, userId: user.id });
      }
      await tx.insert(sellerLoyaltyMembers).values({ clubId: club.id, name: customerName, phone, birthdate, smsConsent: b.smsConsent === true, visits: 1, totalSpent: total, lastVisitAt: new Date() })
        .onConflictDoUpdate({ target: [sellerLoyaltyMembers.clubId, sellerLoyaltyMembers.phone], set: { name: customerName, ...(birthdate ? { birthdate } : {}), visits: sql`${sellerLoyaltyMembers.visits} + 1`, totalSpent: sql`${sellerLoyaltyMembers.totalSpent} + ${total}`, smsConsent: sql`${sellerLoyaltyMembers.smsConsent} OR ${b.smsConsent === true}`, lastVisitAt: new Date(), updatedAt: new Date() } });
      await audit(tx, { userId: user.id, ...meta }, "seller.pos_sale", "seller_pos_sale", createdSale.id, null, { number, sellerId, items: normalized.length, total, commission: 0 });
      let nextRewardCode: string | null = null;
      if (b.sendNextReward === true) {
        nextRewardCode = randomBytes(6).toString("hex").toUpperCase();
        await tx.insert(sellerLoyaltyRewards).values({ sellerId, clubId: club.id, memberPhone: phone, code: nextRewardCode, saleId: createdSale.id, discountPercent: int(b.nextRewardPercent ?? club.rewardPercent,1,50), minSubtotal: 0, expiresAt: new Date(Date.now() + 30 * 86400000) });
      }
      return { ...createdSale, rewardCode: nextRewardCode };
    });
    if (sale.rewardCode && b.smsConsent === true && !("repeated" in sale)) await sendSellerClubSms(sellerId, phone, `${customerName} عزیز، از خرید شما در ${shopName} سپاسگزاریم. کد ${sale.rewardCode} برای ${int(b.nextRewardPercent ?? club.rewardPercent,1,50)}٪ تخفیف خرید حضوری بعدی شماست؛ حداقل خرید ۰ تومان، معتبر تا ۳۰ روز.`);
    else if (b.smsConsent === true && !("repeated" in sale)) await sendSellerClubSms(sellerId, phone, `${customerName} عزیز، از خرید حضوری شما سپاسگزاریم. خرید شما در باشگاه مشتریان ${shopName} ثبت شد.`);
    return { ok: true, id: sale.id, number: sale.number, subtotal: sale.subtotal, discount: sale.discount, total: sale.total, commission: 0, rewardCode: sale.rewardCode };
  } },
  { method: "GET", pattern: "seller/loyalty/rewards/:code", handler: async (_req, params) => {
    const { sellerId } = await sellerUser(), code = str(params.code, 40).toUpperCase();
    const [reward] = await db.select().from(sellerLoyaltyRewards).where(and(eq(sellerLoyaltyRewards.sellerId, sellerId), eq(sellerLoyaltyRewards.code, code), isNull(sellerLoyaltyRewards.redeemedAt), gt(sellerLoyaltyRewards.expiresAt, new Date())));
    if (!reward) throw new HttpError(404, "کد تخفیف باشگاه معتبر نیست یا منقضی شده است");
    return { discountPercent: reward.discountPercent, minSubtotal: reward.minSubtotal, expiresAt: reward.expiresAt };
  } },
  { method: "PUT", pattern: "seller/loyalty/reward-settings", handler: async (req, _p, meta) => {
    const { user, sellerId } = await sellerUser(), b = await body(req), { club } = await ensureClub(sellerId);
    const rewardPercent = int(b.rewardPercent, 0, 50), rewardMinSubtotal = int(b.rewardMinSubtotal, 0), rewardValidityDays = int(b.rewardValidityDays, 1, 365);
    const [updated] = await db.update(sellerLoyaltyClubs).set({ rewardPercent, rewardMinSubtotal, rewardValidityDays }).where(eq(sellerLoyaltyClubs.id, club.id)).returning();
    await audit(db, { userId: user.id, ...meta }, "seller.loyalty_rewards.settings", "seller_loyalty_club", club.id, club, updated);
    return updated;
  } },
  { method: "GET", pattern: "seller/loyalty", handler: async () => {
    const { sellerId } = await sellerUser();
    const { club } = await ensureClub(sellerId);
    const members = await db.select().from(sellerLoyaltyMembers).where(eq(sellerLoyaltyMembers.clubId, club.id)).orderBy(desc(sellerLoyaltyMembers.updatedAt)).limit(1000);
    const [sms] = await db.select({ provider: sellerSmsSettings.provider, senderNumber: sellerSmsSettings.senderNumber, enabled: sellerSmsSettings.enabled, configured: sql<boolean>`(${sellerSmsSettings.apiKey} is not null and ${sellerSmsSettings.apiKey} <> '')` }).from(sellerSmsSettings).where(eq(sellerSmsSettings.sellerId, sellerId));
    return { club, members, sms: sms ?? { provider: "simulate", senderNumber: null, enabled: false, configured: false } };
  } },
  { method: "POST", pattern: "seller/loyalty/members", handler: async (req, _p, meta) => {
    const { user, sellerId } = await sellerUser();
    const b = await body(req), name = str(b.name, 100), phone = phoneValue(b.phone), birthText=str(b.birthdate,10), birthdate=birthText?new Date(`${birthText}T12:00:00.000Z`):null;
    if(birthText&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthText)||Number.isNaN(birthdate?.getTime())))throw new HttpError(400,"تاریخ تولد معتبر نیست");
    if (!name) throw new HttpError(400, "نام مشتری الزامی است");
    if (!/^09\d{9}$/.test(phone)) throw new HttpError(400, "شماره همراه معتبر وارد کنید");
    const { club } = await ensureClub(sellerId);
    const [member] = await db.insert(sellerLoyaltyMembers).values({ clubId: club.id, name, phone, birthdate, smsConsent: b.smsConsent === true })
      .onConflictDoUpdate({ target: [sellerLoyaltyMembers.clubId, sellerLoyaltyMembers.phone], set: { name, ...(birthdate ? { birthdate } : {}), smsConsent: sql`${sellerLoyaltyMembers.smsConsent} OR ${b.smsConsent === true}`, updatedAt: new Date() } }).returning();
    await audit(db, { userId: user.id, ...meta }, "seller.loyalty_member", "seller_loyalty_member", member.id, null, { clubId: club.id, smsConsent: member.smsConsent });
    return { id: member.id };
  } },
  { method: "POST", pattern: "seller/loyalty/members/:id/consent", handler: async (req, params, meta) => {
    const { user, sellerId } = await sellerUser(), id = int(params.id, 1), consent = (await body(req)).smsConsent === true;
    const { club } = await ensureClub(sellerId);
    const [member] = await db.select().from(sellerLoyaltyMembers).where(and(eq(sellerLoyaltyMembers.id, id), eq(sellerLoyaltyMembers.clubId, club.id)));
    if (!member) throw new HttpError(404, "عضو این باشگاه یافت نشد");
    await db.update(sellerLoyaltyMembers).set({ smsConsent: consent, updatedAt: new Date() }).where(eq(sellerLoyaltyMembers.id, id));
    await audit(db, { userId: user.id, ...meta }, "seller.loyalty_consent", "seller_loyalty_member", id, { smsConsent: member.smsConsent }, { smsConsent: consent });
    return { ok: true };
  } },
  { method: "DELETE", pattern: "seller/loyalty/members/:id", handler: async (_req, params, meta) => {
    const { user, sellerId } = await sellerUser(), id = int(params.id, 1);
    const { club } = await ensureClub(sellerId);
    const [member] = await db.select().from(sellerLoyaltyMembers).where(and(eq(sellerLoyaltyMembers.id, id), eq(sellerLoyaltyMembers.clubId, club.id)));
    if (!member) throw new HttpError(404, "عضو این باشگاه یافت نشد");
    await db.delete(sellerLoyaltyMembers).where(eq(sellerLoyaltyMembers.id, member.id));
    await audit(db, { userId: user.id, ...meta }, "seller.loyalty_remove", "seller_loyalty_member", id, { phone: member.phone }, null);
    return { ok: true };
  } },
  { method: "PUT", pattern: "seller/loyalty/sms-settings", handler: async (req, _p, meta) => {
    const { user, sellerId } = await sellerUser(), b = await body(req);
    const provider = ["simulate", "kavenegar", "smsir"].includes(str(b.provider, 20)) ? str(b.provider, 20) : "";
    if (!provider) throw new HttpError(400, "سرویس پیامک را انتخاب کنید");
    const senderNumber = str(b.senderNumber, 40) || null;
    const apiKey = str(b.apiKey, 300);
    const [existing] = await db.select().from(sellerSmsSettings).where(eq(sellerSmsSettings.sellerId, sellerId));
    const values = { sellerId, provider, senderNumber, enabled: b.enabled === true, apiKey: apiKey || existing?.apiKey || null, updatedAt: new Date() };
    if (existing) await db.update(sellerSmsSettings).set(values).where(eq(sellerSmsSettings.id, existing.id));
    else await db.insert(sellerSmsSettings).values(values);
    await audit(db, { userId: user.id, ...meta }, "seller.loyalty_sms_settings", "seller", sellerId, null, { provider, senderNumber, enabled: values.enabled, hasKey: !!values.apiKey });
    return { ok: true, configured: !!values.apiKey };
  } },
  { method: "POST", pattern: "seller/loyalty/send", handler: async (req, _p, meta) => {
    const { user, sellerId } = await sellerUser();
    await assertSellerAllowed(sellerId, "ارسال پیامک به باشگاه مشتریان");
    rateLimit(`seller-loyalty-sms:${sellerId}`, 3, 60_000);
    const b = await body(req), message = str(b.message, 800);
    if (message.length < 3) throw new HttpError(400, "متن پیامک حداقل ۳ نویسه باشد");
    const [setting] = await db.select().from(sellerSmsSettings).where(eq(sellerSmsSettings.sellerId, sellerId));
    if (!setting?.enabled) throw new HttpError(400, "پنل پیامک باشگاه را ابتدا فعال کنید");
    if (setting.provider !== "simulate" && !setting.apiKey) throw new HttpError(400, "کلید API پنل پیامک ثبت نشده است");
    const { club, shopName } = await ensureClub(sellerId);
    const members = await db.select().from(sellerLoyaltyMembers).where(and(eq(sellerLoyaltyMembers.clubId, club.id), eq(sellerLoyaltyMembers.smsConsent, true))).limit(501);
    if (members.length > 500) throw new HttpError(400, "برای ارسال بیش از ۵۰۰ گیرنده، فهرست باشگاه را به چند نوبت تقسیم کنید");
    if (!members.length) throw new HttpError(400, "عضوی با رضایت دریافت پیامک در باشگاه نیست");
    let sent = 0, failed = 0;
    for (const member of members) {
      const bodyText = message.replace(/\{\{\s*name\s*\}\}/g, member.name).replace(/\{\{\s*shop\s*\}\}/g, shopName);
      const status = await sendSellerClubSms(sellerId, member.phone, bodyText);
      if (status === "sent" || status === "simulated") sent++; else failed++;
    }
    await audit(db, { userId: user.id, ...meta }, "seller.loyalty_sms_send", "seller_loyalty_club", club.id, null, { recipients: members.length, sent, failed });
    return { ok: true, recipients: members.length, sent, failed };
  } },
];
