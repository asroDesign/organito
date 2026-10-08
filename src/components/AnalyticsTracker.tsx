"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analyticsPageKey, trackAnalyticsEvent } from "@/lib/analytics-client";

export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (analyticsPageKey(pathname)) trackAnalyticsEvent("page_view", undefined, pathname);
  }, [pathname]);

  return null;
}
