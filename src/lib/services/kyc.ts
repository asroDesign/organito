import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { media, sellerDocuments, sellers } from "@/db/schema";
import { audit, notify } from "../audit";
import { HttpError, str } from "../util";
import type { Ctx, DB } from "../types";

export const DOC_TYPES: Record<string, { title: string; for: ("individual" | "legal")[]; required: ("individual" | "legal")[] }> = {
  national_card: { title: "تصویر کارت ملی (پشت و رو)", for: ["individual", "legal"], required: ["individual", "legal"] },
  birth_certificate: { title: "تصویر شناسنامه (صفحه اول)", for: ["individual"], required: ["individual"] },
  business_license: { title: "جواز کسب / پروانه فعالیت", for: ["individual", "legal"], required: [] },
  official_gazette: { title: "روزنامه رسمی تأسیس و آخرین تغییرات", for: ["legal"], required: ["legal"] },
  articles: { title: "اساسنامه شرکت", for: ["legal"], required: [] },
  signatory_id: { title: "کارت ملی صاحبان امضای مجاز", for: ["legal"], required: ["legal"] },
  vat_certificate: { title: "گواهی ارزش افزوده / کد اقتصادی", for: ["individual", "legal"], required: [] },
  bank_letter: { title: "نامه یا تصویر کارت بانکی به نام متقاضی", for: ["individual", "legal"], required: [] },
  other: { title: "سایر مدارک", for: ["individual", "legal"], required: [] },
};

export const PROFILE_FIELDS: Record<"individual" | "legal", [string, string, boolean][]> = {
  individual: [["firstName", "نام", true], ["lastName", "نام خانوادگی", true], ["nationalCode", "کد ملی", true], ["birthDate", "تاریخ تولد", false], ["fatherName", "نام پدر", false], ["mobile", "موبایل", true], ["phone", "تلفن ثابت", false], ["postalCode", "کد پستی", true], ["address", "نشانی کامل", true], ["licenseNumber", "شماره جواز کسب", false], ["guild", "صنف / اتحادیه", false], ["economicCode", "کد اقتصادی", false]],
  legal: [["companyName", "نام شرکت", true], ["companyType", "نوع شرکت (سهامی خاص، مسئولیت محدود...)", true], ["registrationNumber", "شماره ثبت", true], ["nationalId", "شناسه ملی شرکت (۱۱ رقم)", true], ["economicCode", "کد اقتصادی", true], ["registrationDate", "تاریخ ثبت", false], ["ceoName", "نام مدیرعامل", true], ["ceoNationalCode", "کد ملی مدیرعامل", true], ["signatories", "صاحبان امضای مجاز", true], ["phone", "تلفن شرکت", true], ["postalCode", "کد پستی", true], ["address", "نشانی دفتر مرکزی", true], ["licenseNumber", "شماره پروانه فعالیت", false]],
};

export const DOC_STATUS: Record<string, string> = { requested: "درخواست‌شده — بارگذاری نشده", pending: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده — نیاز به بارگذاری مجدد" };
export const KYC_STATUS: Record<string, string> = { incomplete: "تکمیل نشده", submitted: "ارسال‌شده — در حال بررسی", verified: "احراز هویت شده", needs_info: "نیازمند اطلاعات تکمیلی" };

function validCode(code: string) {
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
  const c = Number(code[9]);
  const s = code.slice(0, 9).split("").reduce((a, d, i) => a + Number(d) * (10 - i), 0) % 11;
  return s < 2 ? c === s : c === 11 - s;
}

/** Recomputes KYC state from documents: any open request/rejection → needs_info (+restrict when flagged). */
export async function refreshKyc(tx: DB, sellerId: number) {
  const [s] = await tx.select().from(sellers).where(eq(sellers.id, sellerId));
  const docs = await tx.select().from(sellerDocuments).where(eq(sellerDocuments.sellerId, sellerId));
  const et = s.entityType as "individual" | "legal";
  const needed = Object.entries(DOC_TYPES).filter(([, d]) => d.required.includes(et)).map(([k]) => k);
  const openReq = docs.filter((d) => d.required && ["requested", "rejected"].includes(d.status));
  const approvedTypes = new Set(docs.filter((d) => d.status === "approved").map((d) => d.type));
  let kyc = s.kycStatus;
  if (openReq.length) kyc = "needs_info";
  else if (needed.every((t) => approvedTypes.has(t)) && s.kycStatus !== "incomplete") kyc = "verified";
  else if (s.kycStatus === "needs_info" || s.kycStatus === "verified") kyc = docs.some((d) => d.status === "pending") ? "submitted" : s.kycStatus === "verified" ? "submitted" : kyc;
  const restricted = s.restricted && openReq.length === 0 ? false : s.restricted;
  await tx.update(sellers).set({ kycStatus: kyc, restricted, restrictReason: restricted ? s.restrictReason : null }).where(eq(sellers.id, sellerId));
  return { kyc, restricted, openReq: openReq.length };
}

export async function saveProfile(ctx: Ctx & { userId: number }, sellerId: number, b: Record<string, unknown>, submit: boolean) {
  const entityType = b.entityType === "legal" ? "legal" : "individual";
  const profile: Record<string, string> = {};
  for (const [k, , req] of PROFILE_FIELDS[entityType]) {
    const v = str(b[k], k === "address" || k === "signatories" ? 400 : 100);
    if (submit && req && !v) throw new HttpError(400, `فیلد «${PROFILE_FIELDS[entityType].find((f) => f[0] === k)![1]}» الزامی است`);
    profile[k] = v;
  }
  if (entityType === "individual" && profile.nationalCode && !validCode(profile.nationalCode)) throw new HttpError(400, "کد ملی نامعتبر است");
  if (entityType === "legal") {
    if (profile.nationalId && !/^\d{11}$/.test(profile.nationalId)) throw new HttpError(400, "شناسه ملی شرکت باید ۱۱ رقم باشد");
    if (profile.ceoNationalCode && !validCode(profile.ceoNationalCode)) throw new HttpError(400, "کد ملی مدیرعامل نامعتبر است");
  }
  if (profile.postalCode && !/^\d{10}$/.test(profile.postalCode)) throw new HttpError(400, "کد پستی باید ۱۰ رقم باشد");
  const iban = str(b.iban, 30).replace(/\s/g, "").toUpperCase();
  if (iban && !/^IR\d{24}$/.test(iban)) throw new HttpError(400, "شماره شبا نامعتبر است");
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(sellers).where(eq(sellers.id, sellerId)).for("update");
    if (submit) {
      const docs = await tx.select().from(sellerDocuments).where(eq(sellerDocuments.sellerId, sellerId));
      const missing = Object.entries(DOC_TYPES).filter(([k, d]) => d.required.includes(entityType) && !docs.some((x) => x.type === k && x.mediaId && x.status !== "rejected"));
      if (missing.length) throw new HttpError(400, `مدارک الزامی بارگذاری نشده: ${missing.map(([, d]) => d.title).join("، ")}`);
    }
    const kycStatus = submit ? (old.kycStatus === "verified" ? "verified" : "submitted") : old.kycStatus;
    await tx.update(sellers).set({
      entityType, profile, kycStatus, iban: iban || old.iban,
      nationalId: entityType === "legal" ? profile.nationalId || old.nationalId : profile.nationalCode || old.nationalId,
      legalDocs: entityType === "legal" ? `حقوقی — ${profile.companyName ?? ""}` : `حقیقی — ${profile.firstName ?? ""} ${profile.lastName ?? ""}`,
    }).where(eq(sellers.id, sellerId));
    await audit(tx, ctx, submit ? "seller.kyc_submit" : "seller.profile_update", "seller", sellerId, { entityType: old.entityType, kycStatus: old.kycStatus }, { entityType, kycStatus });
    if (submit) await notifyStaff(tx, `مدارک تأمین‌کننده «${old.shopName}» برای بررسی ارسال شد`, `/admin/marketplace/sellers/${sellerId}`);
    return { kycStatus };
  });
}

async function notifyStaff(tx: DB, title: string, link: string) {
  const { users } = await import("@/db/schema");
  const staff = await tx.select({ id: users.id }).from(users).where(inArray(users.role, ["super_admin", "marketplace_manager"]));
  for (const s of staff) await notify(tx, s.id, title, undefined, link);
}

/** Seller uploads a file into a slot (either an admin request or a self-chosen type). */
export async function uploadDocument(ctx: Ctx & { userId: number }, sellerId: number, input: { docId?: number; type?: string; title?: string; mediaId: number }) {
  return db.transaction(async (tx) => {
    const [m] = await tx.select({ id: media.id, by: media.uploadedBy }).from(media).where(eq(media.id, input.mediaId));
    if (!m || m.by !== ctx.userId) throw new HttpError(403, "فایل نامعتبر");
    let doc;
    if (input.docId) {
      [doc] = await tx.select().from(sellerDocuments).where(and(eq(sellerDocuments.id, input.docId), eq(sellerDocuments.sellerId, sellerId))).for("update");
      if (!doc) throw new HttpError(404, "مدرک یافت نشد");
      if (doc.status === "approved") throw new HttpError(400, "مدرک تأییدشده قابل جایگزینی نیست");
      [doc] = await tx.update(sellerDocuments).set({ mediaId: m.id, status: "pending", uploadedAt: new Date(), reviewNote: null }).where(eq(sellerDocuments.id, doc.id)).returning();
    } else {
      const type = input.type && DOC_TYPES[input.type] ? input.type : "other";
      const [s] = await tx.select().from(sellers).where(eq(sellers.id, sellerId));
      const required = DOC_TYPES[type].required.includes(s.entityType as "individual");
      const [existing] = await tx.select().from(sellerDocuments).where(and(eq(sellerDocuments.sellerId, sellerId), eq(sellerDocuments.type, type), inArray(sellerDocuments.status, ["pending", "rejected", "requested"])));
      if (existing && type !== "other") [doc] = await tx.update(sellerDocuments).set({ mediaId: m.id, status: "pending", uploadedAt: new Date(), reviewNote: null }).where(eq(sellerDocuments.id, existing.id)).returning();
      else [doc] = await tx.insert(sellerDocuments).values({ sellerId, type, title: type === "other" ? str(input.title, 120) || DOC_TYPES.other.title : DOC_TYPES[type].title, mediaId: m.id, status: "pending", required, uploadedAt: new Date() }).returning();
    }
    await audit(tx, ctx, "seller.document_upload", "seller_document", doc.id, null, { type: doc.type, mediaId: m.id });
    const st = await refreshKyc(tx, sellerId);
    if (st.openReq === 0) {
      const [s] = await tx.select().from(sellers).where(eq(sellers.id, sellerId));
      await notifyStaff(tx, `مدرک «${doc.title}» توسط «${s.shopName}» بارگذاری شد`, `/admin/marketplace/sellers/${sellerId}`);
    }
    return doc;
  });
}

export async function requestDocument(ctx: Ctx & { userId: number }, sellerId: number, input: { type: string; title: string; note: string; dueDays: number; restrict: boolean }) {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(sellers).where(eq(sellers.id, sellerId)).for("update");
    if (!s) throw new HttpError(404, "تأمین‌کننده یافت نشد");
    const type = DOC_TYPES[input.type] ? input.type : "other";
    const title = str(input.title, 120) || DOC_TYPES[type].title;
    const [doc] = await tx.insert(sellerDocuments).values({
      sellerId, type, title, status: "requested", required: true, requestedBy: ctx.userId, requestNote: input.note || null,
      dueAt: input.dueDays > 0 ? new Date(Date.now() + input.dueDays * 864e5) : null,
    }).returning();
    if (input.restrict) await tx.update(sellers).set({ restricted: true, restrictReason: `مدارک ناقص: ${title}` }).where(eq(sellers.id, sellerId));
    await refreshKyc(tx, sellerId);
    await notify(tx, s.userId, `درخواست مدرک: ${title}`, `${input.note ? input.note + " — " : ""}${input.restrict ? "تا بارگذاری این مدرک، دسترسی‌های فروش شما محدود است." : "لطفاً در اسرع وقت بارگذاری کنید."}`, "/seller/profile");
    await audit(tx, ctx, "seller.document_request", "seller", sellerId, null, { type, title, restrict: input.restrict });
    return doc;
  });
}

export async function reviewDocument(ctx: Ctx & { userId: number }, docId: number, action: "approve" | "reject", note: string, restrict?: boolean) {
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(sellerDocuments).where(eq(sellerDocuments.id, docId)).for("update");
    if (!d) throw new HttpError(404, "مدرک یافت نشد");
    if (action === "approve" && !d.mediaId) throw new HttpError(400, "فایلی برای تأیید بارگذاری نشده است");
    if (action === "reject" && !note) throw new HttpError(400, "دلیل رد الزامی است");
    await tx.update(sellerDocuments).set({ status: action === "approve" ? "approved" : "rejected", required: action === "reject" ? true : d.required, reviewNote: note || null, reviewedBy: ctx.userId, reviewedAt: new Date() }).where(eq(sellerDocuments.id, d.id));
    if (action === "reject" && restrict) await tx.update(sellers).set({ restricted: true, restrictReason: `مدرک ردشده: ${d.title}` }).where(eq(sellers.id, d.sellerId));
    const st = await refreshKyc(tx, d.sellerId);
    const [s] = await tx.select().from(sellers).where(eq(sellers.id, d.sellerId));
    await notify(tx, s.userId, action === "approve" ? `مدرک «${d.title}» تأیید شد` : `مدرک «${d.title}» رد شد`, action === "reject" ? `${note}${st.restricted ? " — دسترسی‌های شما تا اصلاح مدرک محدود است." : ""}` : st.kyc === "verified" ? "احراز هویت شما تکمیل شد." : undefined, "/seller/profile");
    await audit(tx, ctx, `seller.document_${action}`, "seller_document", d.id, { status: d.status }, { status: action, note });
  });
}

export async function setRestriction(ctx: Ctx & { userId: number }, sellerId: number, restricted: boolean, reason: string) {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(sellers).where(eq(sellers.id, sellerId)).for("update");
    if (!s) throw new HttpError(404, "تأمین‌کننده یافت نشد");
    await tx.update(sellers).set({ restricted, restrictReason: restricted ? reason || "مدارک ناقص" : null }).where(eq(sellers.id, sellerId));
    await notify(tx, s.userId, restricted ? "دسترسی‌های فروش شما محدود شد" : "محدودیت حساب شما برداشته شد", restricted ? reason : undefined, "/seller/profile");
    await audit(tx, ctx, restricted ? "seller.restrict" : "seller.unrestrict", "seller", sellerId, { restricted: s.restricted }, { restricted, reason });
  });
}

/** Throws when a restricted seller attempts a gated action. */
export async function assertSellerAllowed(sellerId: number, action: string) {
  const [s] = await db.select({ restricted: sellers.restricted, reason: sellers.restrictReason }).from(sellers).where(eq(sellers.id, sellerId));
  if (s?.restricted) throw new HttpError(403, `حساب شما به دلیل «${s.reason ?? "مدارک ناقص"}» محدود شده است؛ ${action} تا تکمیل مدارک امکان‌پذیر نیست. به بخش «پروفایل و مدارک» مراجعه کنید.`);
}
