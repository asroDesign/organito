import { auditLogs, notifications } from "@/db/schema";
import type { Ctx, DB } from "./types";

const SECRET_KEYS = /pass|secret|token|api_?key|hash/i;

function scrub(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(scrub);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "data") continue;
      out[k] = SECRET_KEYS.test(k) ? "***" : scrub(val);
    }
    return out;
  }
  return v;
}

export async function audit(tx: DB, ctx: Ctx, action: string, entity: string, entityId: string | number | null, oldValue?: unknown, newValue?: unknown) {
  await tx.insert(auditLogs).values({
    userId: ctx.userId, action, entity, entityId: entityId === null ? null : String(entityId),
    oldValue: scrub(oldValue) as object | null, newValue: scrub(newValue) as object | null,
    ip: ctx.ip ?? null, userAgent: ctx.ua?.slice(0, 300) ?? null,
  });
}

export async function notify(tx: DB, userId: number, title: string, body?: string, link?: string) {
  await tx.insert(notifications).values({ userId, title, body, link });
}
