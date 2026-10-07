"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ClipboardList, ExternalLink, Phone, Save, UserRound } from "lucide-react";
import { api, toast } from "./client";
import { Badge, StatusBadge, Table, Td } from "./ui";
import { Modal } from "./Modal";
import { Pagination } from "./Pagination";
import { jdate } from "@/lib/util";

type Inquiry = { id: number; number: string; productId: number; variantId: number | null; userId: number | null; customerName: string; phone: string; message: string | null; status: string; assignedTo: number | null; internalNote: string | null; convertedOrderId: number | null; createdAt: Date };
type InquiryRow = { inquiry: Inquiry; productName: string; productSlug: string; variantTitle: string | null; operatorName: string | null };
type SelectedInquiry = Inquiry & Omit<InquiryRow, "inquiry">;
type Operator = { id: number; name: string; role: string };
const statusLabels: Record<string, string> = { new: "جدید", contacted: "تماس گرفته شد", closed: "بسته‌شده", converted: "تبدیل به سفارش" };
const roleLabels: Record<string, string> = { super_admin: "مدیر کل", marketplace_manager: "مدیر مارکت‌پلیس", procurement_manager: "مدیر تأمین", support: "پشتیبان", catalog_manager: "مدیر کاتالوگ" };

export function ProductInquiryManager({ rows, total, page, pageSize, q, status, counts, operators }: { rows: InquiryRow[]; total: number; page: number; pageSize: number; q: string; status: string; counts: Record<string, number>; operators: Operator[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedInquiry | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState({ status: "new", assignedTo: "", internalNote: "", convertedOrderId: "" });
  const open = (item: SelectedInquiry) => { setSelected(item); setDraft({ status: item.status, assignedTo: item.assignedTo ? String(item.assignedTo) : "", internalNote: item.internalNote ?? "", convertedOrderId: item.convertedOrderId ? String(item.convertedOrderId) : "" }); setError(""); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return; setBusy(true); setError("");
    try { await api(`/api/admin/product-inquiries/${selected.id}`, "POST", { ...draft, assignedTo: draft.assignedTo || null, convertedOrderId: draft.convertedOrderId || null }); toast("پیگیری استعلام ذخیره شد"); setSelected(null); router.refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="درخواست‌های جدید" value={counts.new ?? 0} tone="yellow"/><StatCard label="در انتظار پیگیری" value={counts.contacted ?? 0} tone="blue"/><StatCard label="تبدیل‌شده به سفارش" value={counts.converted ?? 0} tone="green"/><StatCard label="بسته‌شده" value={counts.closed ?? 0} tone="gray"/></div>
    <form method="get" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto_auto]"><input name="q" defaultValue={q} className="input" placeholder="شماره درخواست، نام، موبایل یا محصول"/><select className="input" name="status" defaultValue={status}><option value="">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button className="btn-primary">جستجو</button><Link href="/admin/product-inquiries" className="btn-ghost">پاک‌کردن</Link></form>
    <Table head={["درخواست / مشتری", "محصول", "وضعیت", "اپراتور", "زمان ثبت", ""]} empty={!rows.length}>
      {rows.map(({ inquiry, productName, productSlug, variantTitle, operatorName }) => <tr key={inquiry.id} className="hover:bg-slate-50"><Td><div className="font-bold">{inquiry.customerName}</div><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><a href={`tel:${inquiry.phone}`} dir="ltr" className="hover:text-emerald-700">{inquiry.phone}</a><a href={`tel:${inquiry.phone}`} aria-label="تماس با مشتری" className="text-emerald-700"><Phone className="size-3.5"/></a></div><small className="text-slate-400" dir="ltr">{inquiry.number}</small></Td><Td><Link href={`/products/${productSlug}`} target="_blank" className="font-bold text-emerald-800 hover:underline">{productName}<ExternalLink className="mr-1 inline size-3"/></Link>{variantTitle && <span className="mt-1 block text-xs text-slate-500">تنوع: {variantTitle}</span>}{inquiry.message && <p className="mt-1 max-w-xs truncate text-xs text-slate-500" title={inquiry.message}>{inquiry.message}</p>}</Td><Td><StatusBadge status={inquiry.status} map={statusLabels}/></Td><Td>{operatorName ? <span className="flex items-center gap-1 text-xs"><UserRound className="size-3.5 text-slate-400"/>{operatorName}</span> : <Badge>تخصیص‌نیافته</Badge>}</Td><Td className="whitespace-nowrap text-xs">{jdate(inquiry.createdAt, true)}</Td><Td><button className="btn-sm" onClick={() => open({ ...inquiry, productName, productSlug, variantTitle, operatorName })}>پیگیری</button></Td></tr>)}
    </Table>
    <Pagination page={page} pageSize={pageSize} total={total}/>
    {selected && <Modal title={`پیگیری ${selected.number}`} onClose={() => !busy && setSelected(null)}>
      <form onSubmit={save} className="space-y-4"><div className="rounded-xl bg-slate-100 p-3 text-sm"><b>{selected.customerName}</b> · <a href={`tel:${selected.phone}`} dir="ltr" className="text-emerald-800">{selected.phone}</a><p className="mt-1">{selected.productName}{selected.variantTitle ? ` — ${selected.variantTitle}` : ""}</p>{selected.message && <p className="mt-2 border-t border-slate-200 pt-2 text-xs leading-6 text-slate-600">{selected.message}</p>}</div>
        <label className="block text-sm font-bold">وضعیت<select className="input mt-1" value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value})}>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block text-sm font-bold">اپراتور مسئول<select className="input mt-1" value={draft.assignedTo} onChange={(e)=>setDraft({...draft,assignedTo:e.target.value})}><option value="">بدون تخصیص</option>{operators.map((person)=><option key={person.id} value={person.id}>{person.name} · {roleLabels[person.role]??person.role}</option>)}</select></label>
        {draft.status === "converted" && <label className="block text-sm font-bold">شمارهٔ شناسه سفارش<input inputMode="numeric" dir="ltr" required className="input mt-1" value={draft.convertedOrderId} onChange={(e)=>setDraft({...draft,convertedOrderId:e.target.value})} placeholder="شناسه سفارش در پنل"/><span className="mt-1 block text-xs font-normal text-slate-500">سفارش فقط در صورت تطبیق شماره موبایل مشتری ثبت می‌شود.</span></label>}
        <label className="block text-sm font-bold">یادداشت داخلی<textarea rows={4} maxLength={3000} className="input mt-1" value={draft.internalNote} onChange={(e)=>setDraft({...draft,internalNote:e.target.value})} placeholder="نتیجه تماس یا توضیح برای پیگیری بعدی"/></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="flex justify-end"><button disabled={busy} className="btn-primary"><Save className="size-4"/>{busy?"در حال ذخیره…":"ذخیره پیگیری"}</button></div>
      </form>
    </Modal>}
  </div>;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "yellow" | "blue" | "green" | "gray" }) {
  const colors = { yellow: "bg-amber-50 text-amber-900 ring-amber-200", blue: "bg-sky-50 text-sky-900 ring-sky-200", green: "bg-emerald-50 text-emerald-900 ring-emerald-200", gray: "bg-slate-50 text-slate-800 ring-slate-200" };
  const iconColors = { yellow: "bg-amber-100 text-amber-700", blue: "bg-sky-100 text-sky-700", green: "bg-emerald-100 text-emerald-700", gray: "bg-slate-200 text-slate-600" };
  return <div className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${colors[tone]}`}><span className={`grid size-10 place-items-center rounded-xl ${iconColors[tone]}`}><ClipboardList className="size-5"/></span><div><span className="block text-xs opacity-75">{label}</span><b className="text-2xl">{Number(value).toLocaleString("fa-IR")}</b></div></div>;
}
