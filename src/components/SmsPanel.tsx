"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import { api, toast } from "./client";

const render = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`);
const extract = (b: string) => Array.from(new Set(Array.from(b.matchAll(/\{(\w+)\}/g)).map((m) => m[1])));

type Init = { id?: number; event?: string; title?: string; body?: string; patternId?: string; isSystem?: boolean; parameterMap?: Record<string, string> };
const providerLabel = (provider: string) => ({ kavenegar: "کاوه‌نگار", smsir: "SMS.ir", ghasedak: "قاصدک", melipayamak: "ملی‌پیامک", mediana: "مدیانا", ippanel: "IPPanel" }[provider] ?? provider);
const parameterExample = (provider: string, index: number, variable: string) => provider === "kavenegar" ? ["token", "token2", "token3"][index] ?? `token${index + 1}` : provider === "ghasedak" ? `param${index + 1}` : provider === "melipayamak" ? String(index + 1) : provider === "smsir" ? `PARAMETER${index + 1}` : variable;
export function SmsTemplateEditor({ events, label, initial = {}, small, provider = "smsir" }: { events: [string, string, string[]][]; label: string; initial?: Init; small?: boolean; provider?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Init>({ event: "order_created", title: "", body: "", patternId: "", parameterMap: {}, ...initial });
  const [busy, setBusy] = useState(false);
  const evVars = events.find((e) => e[0] === f.event)?.[2] ?? [];
  const used = extract(f.body ?? "");
  const providerVars = used;
  const unknown = f.event !== "manual" ? used.filter((v) => !evVars.includes(v)) : [];
  return (
    <>
      <button className={small ? "btn-sm" : "btn-primary"} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="modal-scroll-panel w-full max-w-xl space-y-3 rounded-2xl bg-white p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><b>{f.id ? "ویرایش الگو" : "الگوی پیامک جدید"}</b><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            <label className="block">رویداد
              <select disabled={f.isSystem} value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })} className="input mt-1">{events.map(([k, t]) => <option key={k} value={k}>{t} ({k})</option>)}</select></label>
            <label className="block">عنوان الگو<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="input mt-1" /></label>
            <label className="block">Template ID / Pattern ID در سرویس‌دهنده<input value={f.patternId} onChange={(e) => setF({ ...f, patternId: e.target.value })} className="input mt-1" dir="ltr" /></label>
            <p className="-mt-2 text-xs leading-5 text-slate-500">شناسه الگوی تاییدشده در پنل {providerLabel(provider)} را وارد کنید؛ برای IPPanel «Pattern Code» و نام دقیق placeholderهای pattern را وارد کنید. شماره گیرنده به قالب بین‌المللی تبدیل می‌شود.</p>
            <label className="block">متن
              <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="input mt-1 min-h-28" /></label>
            {evVars.length > 0 && <div className="flex flex-wrap gap-1">{evVars.map((v) => <button key={v} type="button" className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700" onClick={() => setF({ ...f, body: `${f.body ?? ""}{${v}}` })}>{`{${v}}`}</button>)}</div>}
            {unknown.length > 0 && <div className="text-xs text-amber-600">متغیرهای ناشناخته برای این رویداد (در ارسال خودکار پر نمی‌شوند): {unknown.join("، ")}</div>}
            {!!providerVars.length && <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <b className="text-xs">نگاشت پارامترهای قالب در {providerLabel(provider)}</b>
              <p className="mb-2 mt-1 text-[11px] leading-5 text-slate-600">نام/ترتیب پارامترها باید دقیقاً مطابق قالب تاییدشده پنل باشد. مقدار پیشنهادی را با قرارداد همان سرویس تطبیق دهید.</p>
              <div className="grid gap-2 sm:grid-cols-2">{providerVars.map((v, index) => <label key={v} className="text-xs text-slate-600">{`{${v}}`}<input value={f.parameterMap?.[v] ?? parameterExample(provider, index, v)} onChange={(e) => setF({ ...f, parameterMap: { ...f.parameterMap, [v]: e.target.value } })} className="input mt-1" dir="ltr" placeholder={parameterExample(provider, index, v)} /></label>)}</div>
            </div>}
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6"><b>پیش‌نمایش:</b> {render(f.body ?? "", Object.fromEntries(used.map((v) => [v, `«${v}»`])))}<div className="mt-1 text-slate-400">{(f.body ?? "").length.toLocaleString("fa-IR")} کاراکتر · حدود {Math.max(1, Math.ceil((f.body ?? "").length / 70)).toLocaleString("fa-IR")} پیامک</div></div>
            <button disabled={busy} className="btn-primary w-full" onClick={async () => {
              setBusy(true);
              try {
                const parameterMap = Object.fromEntries(providerVars.map((v, index) => [v, f.parameterMap?.[v] || parameterExample(provider, index, v)]));
                await api(f.id ? `/api/admin/sms-templates/${f.id}` : "/api/admin/sms-templates", "POST", { ...f, parameterMap });
                toast("الگو ذخیره شد"); setOpen(false); router.refresh();
              }
              catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
            }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ذخیره الگو</button>
          </div>
        </div>
      )}
    </>
  );
}

export function SmsSender({ templates }: { templates: { id: number; title: string; event: string; body: string; variables: string[] }[] }) {
  const router = useRouter();
  const [tid, setTid] = useState(templates[0]?.id ?? 0);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [target, setTarget] = useState("phones");
  const [phones, setPhones] = useState("");
  const [busy, setBusy] = useState(false);
  const tpl = useMemo(() => templates.find((t) => t.id === tid), [templates, tid]);
  if (!tpl) return <p className="text-sm text-slate-500">ابتدا یک الگو تعریف کنید.</p>;
  return (
    <div className="space-y-3 text-sm">
      <select value={tid} onChange={(e) => { setTid(Number(e.target.value)); setVars({}); }} className="input">{templates.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.event}</option>)}</select>
      {tpl.variables.map((v) => <input key={v} value={vars[v] ?? ""} onChange={(e) => setVars({ ...vars, [v]: e.target.value })} placeholder={`مقدار {${v}}`} className="input" />)}
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6">{render(tpl.body, vars)}</div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs">
        {[["phones", "شماره‌های دلخواه"], ["customers", "همه مشتریان"], ["sellers", "همه فروشندگان"]].map(([k, l]) => <button key={k} type="button" onClick={() => setTarget(k)} className={`rounded-lg py-1.5 ${target === k ? "bg-white font-bold shadow" : ""}`}>{l}</button>)}
      </div>
      {target === "phones" && <textarea value={phones} onChange={(e) => setPhones(e.target.value)} placeholder="09121234567, 09351234567" dir="ltr" className="input min-h-20" />}
      <button disabled={busy} className="btn-primary w-full" onClick={async () => {
        if (target !== "phones" && !window.confirm("ارسال گروهی انجام شود؟")) return;
        setBusy(true);
        try { const r = await api<{ sent: number; failed: number }>("/api/admin/sms/send", "POST", { templateId: tid, vars, target, phones }); toast(`ارسال شد: ${r.sent} موفق، ${r.failed} ناموفق`); router.refresh(); }
        catch (e) { toast((e as Error).message, false); } finally { setBusy(false); }
      }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}ارسال پیامک</button>
    </div>
  );
}
