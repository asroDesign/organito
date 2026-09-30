import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { compareSync as compareBcrypt } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sellers, sessions, users, accessRoles } from "@/db/schema";
import { permissionsOf, isStaff, type Permission } from "./rbac";
import { HttpError } from "./util";
import { ensureSeeded } from "./seed";

export const COOKIE = "yt_sid";

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  if (/^\$2[aby]\$/.test(stored)) return compareBcrypt(pw, stored);
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = {
  id: number; name: string; phone: string; role: string; permissions: Permission[];
  avatarMediaId: number | null;
  sellerId: number | null; sellerStatus: string | null; staff: boolean;
};

export async function createSession(userId: number, ip: string | null, ua: string | null) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await db.insert(sessions).values({ id: sha(token), userId, expiresAt, ip, userAgent: ua?.slice(0, 300) });
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt, secure: process.env.COOKIE_SECURE === "true" });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (t) await db.delete(sessions).where(eq(sessions.id, sha(t)));
  c.delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  await ensureSeeded();
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const [row] = await db.select({ u: users, s: sellers }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(sellers, eq(sellers.userId, users.id))
    .where(and(eq(sessions.id, sha(t)), gt(sessions.expiresAt, new Date())));
  if (!row || !row.u.isActive) return null;
  const [customRole] = row.u.roleId ? await db.select().from(accessRoles).where(eq(accessRoles.id,row.u.roleId)) : [];
  const permissions = permissionsOf(row.u.role, [...row.u.extraPermissions,...(customRole?.permissions??[])]);
  return {
    id: row.u.id, name: row.u.name, phone: row.u.phone, role: row.u.role, avatarMediaId: row.u.avatarMediaId,
    permissions,
    sellerId: row.s?.id ?? null, sellerStatus: row.s?.status ?? null, staff: isStaff(row.u.role) || (row.u.role!=="seller" && permissions.length>0),
  };
}

export function can(u: SessionUser | null, p: Permission) {
  return !!u && u.permissions.includes(p);
}

export async function requireApi(p?: Permission): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new HttpError(401, "ابتدا وارد شوید");
  if (p && !can(u, p)) throw new HttpError(403, "دسترسی غیرمجاز");
  return u;
}

export async function requirePage(opts: { perm?: Permission; anyPerm?: Permission[]; role?: "customer" | "seller" | "staff" } = {}) {
  const u = await getUser();
  if (!u) redirect("/login");
  if (opts.role === "seller" && !u.sellerId) redirect("/");
  if (opts.role === "staff" && !u.staff) redirect("/");
  if (opts.perm && !can(u, opts.perm)) redirect("/admin?denied=1");
  if (opts.anyPerm && !opts.anyPerm.some((p) => can(u, p))) redirect("/admin?denied=1");
  return u;
}

export async function reqMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local", ua: h.get("user-agent") };
}

const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return; }
  b.n++;
  if (b.n > max) throw new HttpError(429, "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.");
}
