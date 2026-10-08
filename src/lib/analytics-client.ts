"use client";

export type AnalyticsEventType = "page_view" | "product_view" | "add_to_cart" | "checkout_started";
export type AnalyticsPageKey = "home" | "shop" | "product" | "blog" | "cart";

const SESSION_KEY = "org-analytics-session";
const SESSION_MAX_AGE = 30 * 60 * 1000;

function sessionId() {
  const now = Date.now();
  const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const cookieId = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("org_analytics_session="))?.slice("org_analytics_session=".length);
  try {
    const old = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { id?: string; lastActive?: number } | null;
    if (validId(old?.id) && typeof old?.lastActive === "number" && now - old.lastActive < SESSION_MAX_AGE) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: old.id, lastActive: now }));
      return old.id;
    }
    const id = validId(cookieId) ? cookieId : crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastActive: now }));
    return id;
  } catch {
    return validId(cookieId) ? cookieId : crypto.randomUUID();
  }
}

function pageKey(pathname: string): AnalyticsPageKey | null {
  if (pathname === "/") return "home";
  if (pathname === "/shop" || pathname.startsWith("/shop/")) return "shop";
  if (pathname === "/cart") return "cart";
  if (pathname === "/blog" || pathname.startsWith("/blog/")) return "blog";
  if (pathname.startsWith("/products/")) return "product";
  return null;
}

export function trackAnalyticsEvent(eventType: AnalyticsEventType, productId?: number, path = location.pathname) {
  const id = sessionId();
  const key = pageKey(path);
  if (!id || !key) return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `org_analytics_session=${id}; Max-Age=1800; Path=/; SameSite=Lax${secure}`;
  const eventId = crypto.randomUUID();
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf": "1" },
    body: JSON.stringify({ eventId, eventType, pageKey: key, productId }),
    keepalive: true,
  }).catch(() => undefined);
}

export function analyticsPageKey(pathname: string) { return pageKey(pathname); }
