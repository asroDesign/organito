import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, sellers } from "@/db/schema";
import { requireApi } from "../auth";
import { audit } from "../audit";
import { requestDocument, reviewDocument, saveProfile, setRestriction, uploadDocument } from "../services/kyc";
import { HttpError, int, str } from "../util";
import { body, idParam, type Route } from "./router";

async function requireSeller() {
  const u = await requireApi();
  if (!u.sellerId) throw new HttpError(403, "فقط تأمین‌کنندگان");
  return u as typeof u & { sellerId: number };
}

export const kycRoutes: Route[] = [
  { method: "POST", pattern: "seller/profile", handler: async (req, _p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    return saveProfile({ userId: u.id, ...m }, u.sellerId, b, b.submit === true);
  } },
  { method: "POST", pattern: "seller/documents", handler: async (req, _p, m) => {
    const u = await requireSeller();
    const b = await body(req);
    const d = await uploadDocument({ userId: u.id, ...m }, u.sellerId, { docId: b.docId ? int(b.docId, 1) : undefined, type: str(b.type, 40), title: str(b.title, 120), mediaId: int(b.mediaId, 1) });
    return { id: d.id, status: d.status };
  } },
  { method: "POST", pattern: "admin/sellers/:id/documents/request", handler: async (req, p, m) => {
    const u = await requireApi("SELLER_SETTLEMENT_MANAGE");
    const b = await body(req);
    const d = await requestDocument({ userId: u.id, ...m }, idParam(p.id), { type: str(b.type, 40), title: str(b.title, 120), note: str(b.note, 500), dueDays: int(b.dueDays ?? 0, 0, 365), restrict: b.restrict === true });
    return { id: d.id };
  } },
  { method: "POST", pattern: "admin/seller-documents/:id/review", handler: async (req, p, m) => {
    const u = await requireApi("SELLER_SETTLEMENT_MANAGE");
    const b = await body(req);
    const action = String(b.action);
    if (!["approve", "reject"].includes(action)) throw new HttpError(400, "عملیات نامعتبر");
    await reviewDocument({ userId: u.id, ...m }, idParam(p.id), action as "approve", str(b.note, 500), b.restrict === true);
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sellers/:id/restrict", handler: async (req, p, m) => {
    const u = await requireApi("SELLER_SETTLEMENT_MANAGE");
    const b = await body(req);
    await setRestriction({ userId: u.id, ...m }, idParam(p.id), b.restricted === true, str(b.reason, 300));
    return { ok: true };
  } },
  { method: "POST", pattern: "admin/sellers/:id/terms", handler: async (req, p, m) => {
    const u = await requireApi("SELLER_SETTLEMENT_MANAGE");
    const id = idParam(p.id);
    const b = await body(req);
    const [old] = await db.select().from(sellers).where(eq(sellers.id, id));
    if (!old) throw new HttpError(404, "یافت نشد");
    const pct = Number(b.commissionRate);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50 || !Number.isInteger(pct)) throw new HttpError(400, "نرخ کمیسیون باید عدد صحیح بین ۰ تا ۵۰ باشد");
    const patch = {
      status: ["pending", "approved", "rejected", "suspended"].includes(String(b.status)) ? String(b.status) : old.status,
      contractStatus: ["pending", "signed", "expired"].includes(String(b.contractStatus)) ? String(b.contractStatus) : old.contractStatus,
      commissionRate: pct, settlementDays: int(b.settlementDays ?? old.settlementDays, 0, 90),
    };
    await db.update(sellers).set(patch).where(eq(sellers.id, id));
    await audit(db, { userId: u.id, ...m }, "seller.terms_update", "seller", id, { status: old.status, contractStatus: old.contractStatus, commissionRate: old.commissionRate, settlementDays: old.settlementDays }, patch);
    return { ok: true };
  } },
  // ----- notifications -----
  { method: "GET", pattern: "notifications", handler: async () => {
    const u = await requireApi();
    const list = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(30);
    return { items: list, unread: list.filter((n) => !n.read).length };
  } },
  { method: "POST", pattern: "notifications/:id/read", handler: async (_r, p) => {
    const u = await requireApi();
    await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, idParam(p.id)), eq(notifications.userId, u.id)));
    return { ok: true };
  } },
];
