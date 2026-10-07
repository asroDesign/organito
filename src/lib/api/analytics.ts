import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { analyticsSessionFromCookie, analyticsSourceFromCookie } from "../analytics";
import { rateLimit } from "../auth";
import { HttpError, str } from "../util";
import { body, type Route } from "./router";

const eventTypes = new Set(["page_view", "product_view", "add_to_cart", "checkout_started"]);
const pageKeys = new Set(["home", "shop", "product", "blog", "cart"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const analyticsRoutes: Route[] = [
  { method: "POST", pattern: "analytics/events", handler: async (req) => {
    const sessionId = analyticsSessionFromCookie(req.headers.get("cookie"));
    if (!sessionId) return { ok: true, skipped: true };
    rateLimit(`analytics:${sessionId}`, 300, 15 * 60_000);
    const b = await body(req), eventId = str(b.eventId, 36), eventType = str(b.eventType, 30), pageKey = str(b.pageKey, 20);
    if (!uuid.test(eventId) || !eventTypes.has(eventType) || !pageKeys.has(pageKey)) throw new HttpError(400, "رویداد آمار معتبر نیست");
    const productId = b.productId === undefined || b.productId === null ? null : Number(b.productId);
    if (productId !== null && (!Number.isSafeInteger(productId) || productId < 1)) throw new HttpError(400, "شناسه محصول معتبر نیست");
    if ((eventType === "product_view" || eventType === "add_to_cart") && productId === null) throw new HttpError(400, "برای این رویداد محصول لازم است");
    if (eventType === "checkout_started" && pageKey !== "cart") throw new HttpError(400, "رویداد شروع پرداخت باید از سبد خرید ثبت شود");
    const attribution = analyticsSourceFromCookie(req.headers.get("cookie"));
    after(async () => {
      try {
        await db.insert(analyticsEvents).values({ eventId, sessionId, eventType, pageKey, productId, ...attribution })
          .onConflictDoNothing({ target: analyticsEvents.eventId });
        // Keep the pseudonymous funnel window finite. The random 1-in-16 cleanup
        // avoids running retention writes on every page transition.
        if (eventId[0] === "0") {
          await db.execute(sql`delete from analytics_events where event_id in (select event_id from analytics_events where expires_at < now() limit 1000)`);
          await db.execute(sql`update orders set analytics_session_id = null where created_at < now() - interval '90 days' and analytics_session_id is not null`);
        }
      } catch (error) {
        console.error("Failed to save consent-based analytics event", { eventType, error });
      }
    });
    return { ok: true };
  } },
];
