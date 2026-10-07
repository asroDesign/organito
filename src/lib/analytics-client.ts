"use client";

export type AnalyticsEventType = "page_view" | "product_view" | "add_to_cart" | "checkout_started";
export type AnalyticsPageKey = "home" | "shop" | "product" | "blog" | "cart";

const CONSENT_KEY = "org-analytics-consent";
const SESSION_KEY = "org-analytics-session";
const SESSION_MAX_AGE = 30 * 60 * 1000;

export function analyticsConsent(): "accepted" | "rejected" | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch { return null; }
}

export function setAnalyticsConsent(value: "accepted" | "rejected") {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* Analytics remains unavailable when storage is blocked. */ }
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `org_analytics_consent=${value}; Max-Age=${value === "accepted" ? 15552000 : 31536000}; Path=/; SameSite=Lax${secure}`;
  if (value === "rejected") {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* Ignore storage restrictions. */ }
    document.cookie = `org_analytics_session=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
  }
}

function sessionId() {
  const now = Date.now();
  try {
    const old = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { id?: string; lastActive?: number } | null;
    if (old?.id && typeof old.lastActive === "number" && now - old.lastActive < SESSION_MAX_AGE) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: old.id, lastActive: now }));
      return old.id;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastActive: now }));
    return id;
  } catch { return null; }
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
  if (analyticsConsent() !== "accepted") return;
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
