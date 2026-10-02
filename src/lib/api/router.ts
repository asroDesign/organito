import { NextResponse, type NextRequest } from "next/server";
import { HttpError } from "../util";

export type Meta = { ip: string; ua: string | null };
export type Handler = (req: NextRequest, params: Record<string, string>, meta: Meta) => Promise<unknown>;
export type Route = { method: string; pattern: string; handler: Handler };

export function match(routes: Route[], method: string, parts: string[]) {
  let best: { route: Route; params: Record<string, string> } | null = null;
  let bestSpecificity = -1;
  for (const r of routes) {
    if (r.method !== method) continue;
    const segs = r.pattern.split("/");
    if (segs.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    let specificity = 0;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].startsWith(":")) params[segs[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (segs[i] !== parts[i]) { ok = false; break; }
      else specificity++;
    }
    // Resolve fixed paths such as /admin/blog/categories before broader
    // parameter paths such as /admin/blog/:id, regardless of declaration order.
    if (ok && specificity > bestSpecificity) {
      best = { route: r, params };
      bestSpecificity = specificity;
    }
  }
  return best;
}

export async function dispatch(routes: Route[], req: NextRequest, parts: string[]) {
  const method = req.method;
  try {
    if (method !== "GET" && method !== "HEAD") {
      // CSRF: require custom header (cannot be set cross-site without CORS preflight) and same-origin when Origin is present
      if (req.headers.get("x-csrf") !== "1") throw new HttpError(403, "درخواست نامعتبر (CSRF)");
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "مبدأ درخواست نامعتبر است");
    }
    const m = match(routes, method, parts);
    if (!m) throw new HttpError(404, "مسیر یافت نشد");
    const meta = { ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local", ua: req.headers.get("user-agent") };
    const out = await m.route.handler(req, m.params, meta);
    if (out instanceof Response) return out;
    return NextResponse.json(out ?? { ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    const msg = (e as Error)?.message ?? "";
    if (/unique|duplicate/i.test(msg)) return NextResponse.json({ error: "رکورد تکراری است" }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    throw new HttpError(400, "بدنه درخواست نامعتبر است");
  }
}

export function idParam(v: string) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "شناسه نامعتبر");
  return n;
}
