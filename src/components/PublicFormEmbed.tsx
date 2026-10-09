"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api } from "./client";
import { PublicFormView } from "./PublicFormView";
import type { PublicFormField } from "@/db/schema";

type FormData = { title: string; slug: string; description: string | null; fields: PublicFormField[]; submitLabel: string; successMessage: string; privacyNotice: string | null };

export function PublicFormEmbed({ slug }: { slug: string }) {
  const [form, setForm] = useState<FormData | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    api<FormData>(`/api/forms/${encodeURIComponent(slug)}`, "GET")
      .then((result) => { if (alive) setForm(result); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [slug]);
  if (form) return <PublicFormView form={form} embedded />;
  if (missing) return <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">این فرم منتشر نیست یا در دسترس قرار ندارد.</div>;
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500"><ClipboardList className="size-5 text-amber-600"/>در حال بارگذاری فرم…</div>;
}
