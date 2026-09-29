import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, requireApi } from "../auth";
import { startGatewayPayment, handleGatewayCallback } from "../services/gateway";
import { zpMode } from "../zarinpal";
import { str } from "../util";
import { idParam, type Route } from "./router";

export function baseUrl(req: NextRequest) {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0]}://${host}`;
}

export const gatewayRoutes: Route[] = [
  { method: "POST", pattern: "orders/:id/gateway", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`gw:${u.id}`, 10, 60_000);
    return startGatewayPayment({ userId: u.id, ...m }, { orderId: idParam(p.id) }, baseUrl(req));
  } },
  { method: "POST", pattern: "supply/:id/gateway", handler: async (req, p, m) => {
    const u = await requireApi();
    rateLimit(`gw:${u.id}`, 10, 60_000);
    return startGatewayPayment({ userId: u.id, ...m }, { supplyId: idParam(p.id) }, baseUrl(req));
  } },
  { method: "GET", pattern: "payments/zarinpal/callback", handler: async (req, _p, m) => {
    const q = req.nextUrl.searchParams;
    const authority = str(q.get("Authority"), 64);
    const status = str(q.get("Status"), 5);
    const sim = zpMode() === "simulator" && q.get("sim") === "ok";
    const r = authority ? await handleGatewayCallback(authority, status, sim, m) : { ok: false, paymentId: null, message: "پارامتر Authority ارسال نشده است" };
    const url = new URL(`${baseUrl(req)}/pay/result`);
    url.searchParams.set("ok", r.ok ? "1" : "0");
    if (r.paymentId) url.searchParams.set("pid", String(r.paymentId));
    url.searchParams.set("msg", r.message);
    return NextResponse.redirect(url, 303);
  } },
  { method: "GET", pattern: "payments/gateway-mode", handler: async () => ({ mode: zpMode() }) },
];
