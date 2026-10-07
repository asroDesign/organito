"use client";
import { useState } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import type { PublicFormField } from "@/db/schema";
import { api } from "./client";

type FormData = { title: string; slug: string; description: string | null; fields: PublicFormField[]; submitLabel: string; successMessage: string; privacyNotice: string | null };
export function PublicFormView({ form }: { form: FormData }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({}), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const set = (id: string, value: string | boolean) => setValues((old) => ({ ...old, [id]: value }));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await api<{ ok: boolean; message: string }>(`/api/forms/${form.slug}/submissions`, "POST", { values, website: new FormData(event.currentTarget).get("website") });
      setSuccess(result.message || form.successMessage);
      setValues({});
    } catch (cause) { setError((cause as Error).message || "ثبت پاسخ انجام نشد"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-10 sm:py-16"><div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="h-1.5 bg-gradient-to-l from-amber-400 via-yellow-300 to-emerald-500"/><div className="p-5 sm:p-9">{success ? <div role="status" className="py-8 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-9"/></span><h1 className="mt-5 text-2xl font-black">{form.title}</h1><p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{success}</p></div> : <><p className="text-xs font-bold text-amber-700">فرم آنلاین</p><h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">{form.title}</h1>{form.description && <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{form.description}</p>}<form onSubmit={submit} className="mt-7 space-y-5">
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><label>وب‌سایت<input tabIndex={-1} autoComplete="off" name="website"/></label></div>
      {form.fields.map((field) => <label key={field.id} className="block text-sm font-bold text-slate-700">{field.type !== "checkbox" && field.type !== "consent" && <span>{field.label}{field.required && <span className="mr-1 text-rose-600">*</span>}</span>}{field.type === "textarea" ? <textarea required={field.required} maxLength={field.maxLength ?? 3000} rows={5} placeholder={field.placeholder} value={String(values[field.id] ?? "")} onChange={(event) => set(field.id, event.target.value)} className="input mt-2 min-h-32 leading-7"/> : field.type === "select" ? <select required={field.required} value={String(values[field.id] ?? "")} onChange={(event) => set(field.id, event.target.value)} className="input mt-2"><option value="">انتخاب کنید</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "checkbox" || field.type === "consent" ? <span className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" required={field.required} checked={values[field.id] === true} onChange={(event) => set(field.id, event.target.checked)} className="mt-0.5 size-4 accent-emerald-600"/><span className="leading-6">{field.label}{field.required && <span className="mr-1 text-rose-600">*</span>}</span></span> : <input required={field.required} type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"} inputMode={field.type === "phone" ? "tel" : field.type === "number" ? "decimal" : undefined} maxLength={field.type === "text" ? field.maxLength ?? 250 : field.type === "email" ? 254 : undefined} placeholder={field.placeholder} value={String(values[field.id] ?? "")} onChange={(event) => set(field.id, event.target.value)} className="input mt-2" dir={field.type === "phone" || field.type === "email" || field.type === "number" ? "ltr" : undefined}/>}</label>)}
      {form.privacyNotice && <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">{form.privacyNotice}</p>}{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button disabled={busy} className="btn-primary w-full justify-center sm:w-auto">{busy ? <LoaderCircle className="size-4 animate-spin"/> : <Send className="size-4"/>}{busy ? "در حال ارسال…" : form.submitLabel}</button>
    </form></>}</div></div><p className="mt-5 text-center text-xs text-slate-400">اطلاعات این فرم از طریق اتصال امن ارسال می‌شود.</p></main>;
}
