"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/** CKEditor 5 is browser-only: loaded lazily with SSR disabled. */
export const RichEditor = dynamic(() => import("./RichEditorInner"), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded-xl border border-slate-200 bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>,
});
