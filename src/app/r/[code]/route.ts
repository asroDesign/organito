import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affiliateClicks, affiliateProfiles, affiliateProgramSettings } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(code)) return NextResponse.redirect(new URL("/", request.url));
  const [[config], [affiliate]] = await Promise.all([
    db.select().from(affiliateProgramSettings).where(eq(affiliateProgramSettings.id, 1)),
    db.select().from(affiliateProfiles).where(and(eq(affiliateProfiles.code, code), eq(affiliateProfiles.status, "active"))),
  ]);
  if (!config?.enabled || !affiliate) return NextResponse.redirect(new URL("/", request.url));
  const to = request.nextUrl.searchParams.get("to") ?? "/";
  const landingPath = to.startsWith("/") && !to.startsWith("//") && !to.startsWith("/r/") && !to.startsWith("/api/") ? to.slice(0, 700) : "/";
  const referer = request.headers.get("referer");
  let referrerHost: string | null = null;
  if (referer) { try { referrerHost = new URL(referer).hostname.slice(0, 190); } catch { /* Ignore malformed referrer. */ } }
  await db.insert(affiliateClicks).values({ affiliateUserId: affiliate.userId, landingPath, referrerHost });
  const response = NextResponse.redirect(new URL(landingPath, request.url));
  response.cookies.set("org_affiliate", code, {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/",
    maxAge: Math.max(1, Math.min(365, config.attributionDays)) * 24 * 60 * 60,
  });
  return response;
}
