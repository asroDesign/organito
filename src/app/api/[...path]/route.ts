import type { NextRequest } from "next/server";
import { dispatch } from "@/lib/api/router";
import { commerceRoutes } from "@/lib/api/commerce";
import { crmRoutes } from "@/lib/api/crm";
import { publicRoutes } from "@/lib/api/public";
import { staffRoutes } from "@/lib/api/staff";
import { extraRoutes } from "@/lib/api/extra";
import { marketingRoutes } from "@/lib/api/marketing";
import { paymentRoutes } from "@/lib/api/payments";
import { gatewayRoutes } from "@/lib/api/gateway";
import { warehouseRoutes } from "@/lib/api/warehouse";
import { kycRoutes } from "@/lib/api/kyc";
import { communityRoutes } from "@/lib/api/community";
import { sellerPosRoutes } from "@/lib/api/seller-pos";
import { centralPosRoutes } from "@/lib/api/central-pos";
import { homeBuilderRoutes } from "@/lib/api/home-builder";
import { contentRoutes } from "@/lib/api/content";
import { mediaLibraryRoutes } from "@/lib/api/media-library";
import { customerRoutes } from "@/lib/api/customer";
import { affiliateRoutes } from "@/lib/api/affiliates";
import { brandRoutes } from "@/lib/api/brands";
import { storyRoutes } from "@/lib/api/stories";
import { formRoutes } from "@/lib/api/forms";
import { pickupRoutes } from "@/lib/api/pickup";
import { productImportRoutes } from "@/lib/api/product-import";
import { fxPricingRoutes } from "@/lib/api/fx-pricing";
import { trashRoutes } from "@/lib/api/trash";
import { siteMenuRoutes } from "@/lib/api/site-menus";
import { productInquiryRoutes } from "@/lib/api/product-inquiries";
import { analyticsRoutes } from "@/lib/api/analytics";
import { ensureSeeded } from "@/lib/seed";
import { expireStaleOrders } from "@/lib/services/orders";

export const dynamic = "force-dynamic";
const routes = [...homeBuilderRoutes, ...mediaLibraryRoutes, ...contentRoutes, ...siteMenuRoutes, ...productInquiryRoutes, ...analyticsRoutes, ...commerceRoutes, ...crmRoutes, ...centralPosRoutes, ...sellerPosRoutes, ...communityRoutes, ...customerRoutes, ...affiliateRoutes, ...brandRoutes, ...storyRoutes, ...formRoutes, ...pickupRoutes, ...productImportRoutes, ...fxPricingRoutes, ...trashRoutes, ...kycRoutes, ...warehouseRoutes, ...gatewayRoutes, ...paymentRoutes, ...marketingRoutes, ...extraRoutes, ...publicRoutes, ...staffRoutes];

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
