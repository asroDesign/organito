const SESSION_COOKIE = "org_analytics_session=";
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cookieValue(header: string | null, name: string) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(name))?.slice(name.length) ?? "";
}

export function analyticsSessionFromCookie(header: string | null) {
  const value = cookieValue(header, SESSION_COOKIE);
  return SESSION_ID.test(value) ? value : null;
}

function safeAttributionText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, max);
  return clean || null;
}

export function analyticsSourceFromCookie(header: string | null) {
  const raw = cookieValue(header, "sbz_attribution=");
  if (!raw) return { source: "direct", medium: null, campaign: null };
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    return {
      source: safeAttributionText(value.utmSource, 80) ?? safeAttributionText(value.source, 80) ?? "direct",
      medium: safeAttributionText(value.utmMedium, 80),
      campaign: safeAttributionText(value.utmCampaign, 120),
    };
  } catch {
    return { source: "direct", medium: null, campaign: null };
  }
}
