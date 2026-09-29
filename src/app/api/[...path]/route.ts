import type { NextRequest } from "next/server";
import { dispatch } from "@/lib/api/router";
import { publicRoutes } from "@/lib/api/public";
import { staffRoutes } from "@/lib/api/staff";
import { extraRoutes } from "@/lib/api/extra";
import { marketingRoutes } from "@/lib/api/marketing";
import { paymentRoutes } from "@/lib/api/payments";
import { gatewayRoutes } from "@/lib/api/gateway";
import { warehouseRoutes } from "@/lib/api/warehouse";
import { kycRoutes } from "@/lib/api/kyc";
import { communityRoutes } from "@/lib/api/community";
import { ensureSeeded } from "@/lib/seed";
import { expireStaleOrders } from "@/lib/services/orders";

export const dynamic = "force-dynamic";
const routes = [...communityRoutes, ...kycRoutes, ...warehouseRoutes, ...gatewayRoutes, ...paymentRoutes, ...marketingRoutes, ...extraRoutes, ...publicRoutes, ...staffRoutes];

type Ctx = { params: Promise<{ path: string[] }> };
async function handle(req: NextRequest, ctx: Ctx) {
  await ensureSeeded();
  void expireStaleOrders().catch(() => null);
  const { path } = await ctx.params;
  return dispatch(routes, req, path);
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
