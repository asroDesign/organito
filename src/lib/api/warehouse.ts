import { can, requireApi, type SessionUser } from "../auth";
import { cancelIssue, createIssue, handoverIssue, type IssueScope } from "../services/warehouse";
import { HttpError, int, str } from "../util";
import { body, idParam, type Route } from "./router";

function scopeOf(u: SessionUser): IssueScope {
  if (u.staff && (can(u, "INVENTORY_MANAGE") || can(u, "SHIPMENTS_MANAGE"))) return { staff: true, sellerId: null };
  if (u.sellerId) return { staff: false, sellerId: u.sellerId };
  throw new HttpError(403, "دسترسی غیرمجاز");
}

export const warehouseRoutes: Route[] = [
  { method: "POST", pattern: "shipments/:id/issue", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    const iss = await createIssue({ userId: u.id, ...m }, idParam(p.id), { notes: str(b.notes, 500), carrier: str(b.carrier, 60), packageCount: b.packageCount ? int(b.packageCount, 1, 50) : undefined }, scopeOf(u));
    return { id: iss.id, number: iss.number };
  } },
  { method: "POST", pattern: "warehouse-issues/:id/handover", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    await handoverIssue({ userId: u.id, ...m }, idParam(p.id), { receiverName: str(b.receiverName, 100), receiverPhone: str(b.receiverPhone, 20), receiverNationalId: str(b.receiverNationalId, 10), receiverRole: str(b.receiverRole, 60) }, scopeOf(u));
    return { ok: true };
  } },
  { method: "POST", pattern: "warehouse-issues/:id/cancel", handler: async (req, p, m) => {
    const u = await requireApi();
    const b = await body(req);
    await cancelIssue({ userId: u.id, ...m }, idParam(p.id), str(b.reason, 300), scopeOf(u));
    return { ok: true };
  } },
];
