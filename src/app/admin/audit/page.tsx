import Link from "next/link";
import { and, count, desc, eq, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { Activity, ArrowUpLeft, ClipboardList, Search, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { paginationParams } from "@/lib/pagination";
import { ROLES } from "@/lib/rbac";
import { Badge, Card, FeatureIntro, PageHeader, Stat } from "@/components/ui";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { Pagination } from "@/components/Pagination";
import { faNum, jdate } from "@/lib/util";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: string; entity?: string; from?: string; to?: string; page?: string; pageSize?: string }>;

const CATEGORIES: Record<string, string> = {
  auth: "ورود و امنیت", order: "سفارش", payment: "پرداخت", gateway: "درگاه پرداخت", product: "محصول", offer: "پیشنهاد فروش",
  inventory: "انبار", warehouse: "انبار", seller: "فروشنده", user: "کاربر", role: "دسترسی",
  ticket: "پشتیبانی", supply: "تأمین کالا", return: "مرجوعی", shipment: "ارسال", media: "رسانه",
  sms: "پیامک", campaign: "کمپین", customer: "مشتری", affiliate: "همکاری در فروش", brand: "برند",
  story: "استوری", public_form: "فرم عمومی", site_menu: "منو", pickup: "دریافت حضوری", payment_gateway: "درگاه پرداخت",
  settings: "تنظیمات", home_builder: "صفحه‌ساز", site_page: "صفحه محتوا", content_page: "صفحه محتوا", admin: "مدیریت",
};
const ENTITIES: Record<string, string> = {
  product: "محصول", product_variant: "تنوع محصول", order: "سفارش", payment: "پرداخت", user: "کاربر", seller: "فروشنده",
  seller_offer: "پیشنهاد فروش", inventory: "موجودی", inventory_repack: "بسته‌بندی مجدد", stock_movement: "گردش موجودی",
  warehouse_issue: "حواله انبار", warehouse_transfer: "انتقال انبار", ticket: "تیکت", supply_request: "درخواست تأمین",
  supply_quote: "پیش‌فاکتور تأمین", return: "مرجوعی", shipment: "مرسوله", media: "رسانه", media_folder: "پوشه رسانه",
  sms_template: "الگوی پیامک", campaign: "کمپین", customer_address: "نشانی مشتری", customer_wallet: "کیف پول مشتری",
  customer_wallet_withdrawal: "برداشت مشتری", affiliate: "همکار فروش", affiliate_program: "برنامه همکاری فروش",
  brand: "برند", story: "استوری", public_form: "فرم عمومی", site_menu: "منو", site_menu_item: "آیتم منو",
  pickup_center: "مرکز دریافت", product_inquiry: "استعلام محصول", role: "نقش کاربری", access_role: "نقش دسترسی", settings: "تنظیمات",
  home_page: "صفحه اصلی", content_page: "صفحه محتوا", incomplete_cart: "سبد ناقص", ticket_department: "بخش پشتیبانی",
  session: "نشست ورود", category: "دسته‌بندی", discount: "کد تخفیف", festival: "جشنواره", pos_sale: "فروش حضوری",
};
const VERBS: Record<string, string> = {
  create: "ثبت", register: "ثبت", update: "ویرایش", save: "ذخیره", delete: "حذف", trash: "انتقال به زباله",
  restore: "بازیابی", approve: "تأیید", reject: "رد", cancel: "لغو", status: "تغییر وضعیت", price_change: "تغییر قیمت",
  login: "ورود", login_otp: "ورود با کد یک‌بارمصرف", logout: "خروج", session_revoke: "پایان نشست",
  success: "موفق", failed: "ناموفق", submit: "ارسال", message: "ارسال پیام", upload: "بارگذاری",
  receive: "ورود کالا", adjust: "تعدیل موجودی", repack: "بسته‌بندی مجدد", handover: "تحویل", update_info: "ویرایش اطلاعات",
  refund: "استرداد وجه", approve_return: "تأیید مرجوعی", apply: "درخواست عضویت", withdraw: "درخواست برداشت",
};
const ACTION_LABELS: Record<string, string> = {
  "customer.favorite.add": "افزودن محصول به علاقه‌مندی‌ها", "customer.favorite.remove": "حذف محصول از علاقه‌مندی‌ها",
  "customer.address.create": "ثبت نشانی مشتری", "customer.address.update": "ویرایش نشانی مشتری", "customer.address.delete": "حذف نشانی مشتری",
  "customer.bank.update": "ویرایش اطلاعات بانکی مشتری", "customer.wallet.withdrawal": "ثبت درخواست برداشت مشتری",
  "affiliate.program_update": "ویرایش برنامه همکاری در فروش", "affiliate.product_rule": "ویرایش قاعده پورسانت محصول",
  "admin.loyalty.tiers.update": "ویرایش سطح‌های باشگاه مشتریان", "admin.loyalty_tiers.update": "ویرایش سطح‌های باشگاه مشتریان", "home_builder.publish": "انتشار صفحه اصلی",
  "home_builder.save": "ذخیره تغییرات صفحه‌ساز", "site_page.update": "ویرایش صفحه محتوا", "site_page.create": "ایجاد صفحه محتوا",
  "settings.update": "ویرایش تنظیمات", "settings.save": "ذخیره تنظیمات", "product.price_quick_update": "ویرایش سریع قیمت محصول",
  "incomplete_cart.reason": "ثبت دلیل تکمیل‌نشدن سبد", "incomplete_cart.sms_reminder": "ارسال یادآوری سبد خرید",
  "payment.gateway_start": "شروع پرداخت از درگاه", "payment.gateway_cancel": "لغو پرداخت درگاه", "payment.gateway_success": "تأیید پرداخت درگاه", "payment.gateway_failed": "خطای پرداخت درگاه",
  "inventory.receive_variant": "ورود تنوع کالا به انبار", "inventory.adjust_variant": "تعدیل موجودی تنوع کالا", "inventory.repack": "بسته‌بندی مجدد کالا",
};

const validDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const tehranDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

function labelForAction(action: string, entity: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [prefix, ...rest] = action.split(".");
  if (action === "auth.login") return "ورود به حساب";
  if (action === "auth.login_otp") return "ورود با کد یک‌بارمصرف";
  if (action === "auth.logout") return "خروج از حساب";
  const subject = CATEGORIES[prefix] ?? ENTITIES[entity] ?? "عملیات";
  const translatedRest = rest.map((part) => VERBS[part] ?? (part === "tiers" ? "سطوح" : part === "favorite" ? "علاقه‌مندی" : part === "address" ? "نشانی" : part === "gateway" ? "درگاه" : part === "profile" ? "پروفایل" : part === "loyalty" ? "باشگاه" : part === "product" ? "محصول" : part === "sms" ? "پیامک" : part === "pos" ? "فروش حضوری" : null));
  const words = translatedRest.filter((part): part is string => !!part);
  const verb = VERBS[rest.join(".")] ?? VERBS[rest.at(-1) ?? ""];
  if (words.length === rest.length && words.length) return `${subject} · ${words.join(" · ")}`;
  return `${subject} · ${verb ?? "ثبت تغییر"}`;
}

function entityHref(entity: string, id: string | null) {
  if (!id) return null;
  const numeric = /^\d+$/.test(id);
  if (entity === "product" && numeric) return `/admin/products/${id}`;
  if (entity === "order" && numeric) return `/orders/${id}`;
  if (entity === "ticket" && numeric) return `/admin/tickets/${id}`;
  if (entity === "supply_request" && numeric) return `/admin/supply/${id}`;
  if (entity === "user") return "/admin/users";
  if (entity === "settings") return "/admin/settings";
  if (entity === "home_page") return "/admin/home-builder";
  if (entity === "content_page") return "/admin/site-content";
  if (["seller_offer", "seller", "affiliate", "affiliate_program"].includes(entity)) return "/admin/marketplace";
  if (entity.includes("inventory") || entity.includes("warehouse") || entity === "stock_movement") return "/admin/inventory";
  if (["return", "shipment", "pos_sale"].includes(entity)) return entity === "return" ? "/admin/returns" : entity === "shipment" ? "/admin/shipments" : "/admin/pos";
  if (["ticket_department"].includes(entity)) return "/admin/tickets/departments";
  if (["media", "media_folder"].includes(entity)) return "/admin/media";
  if (["brand", "story", "site_menu", "site_menu_item", "category"].includes(entity)) return entity === "brand" ? "/admin/brands" : entity === "story" ? "/admin/stories" : entity.startsWith("site_menu") ? "/admin/menus" : "/admin/categories";
  if (["sms_template", "campaign"].includes(entity)) return entity === "campaign" ? "/admin/campaigns" : "/admin/sms";
  if (["customer_wallet", "customer_wallet_withdrawal"].includes(entity)) return "/admin/customer-wallet";
  if (entity === "product_inquiry") return "/admin/product-inquiries";
  if (entity === "pickup_center") return "/admin/pickup-centers";
  if (["role", "access_role"].includes(entity)) return "/admin/access";
  return null;
}

const DETAIL_LABELS: Record<string, string> = {
  status: "وضعیت", oldStatus: "وضعیت پیشین", newStatus: "وضعیت جدید", price: "قیمت", basePrice: "قیمت پایه",
  amount: "مبلغ", total: "جمع", qty: "تعداد", quantity: "تعداد", onHand: "موجودی", stock: "موجودی",
  enabled: "فعال", role: "نقش", number: "شماره", type: "نوع", refundMethod: "روش استرداد", provider: "ارائه‌دهنده",
  items: "قلم", commission: "کمیسیون", sections: "بخش", count: "تعداد", variantId: "تنوع", smsConsent: "رضایت پیامک",
};
function safeDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [] as [string, string][];
  const statusLabels: Record<string, string> = { draft: "پیش‌نویس", active: "فعال", inactive: "غیرفعال", pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده", paid: "پرداخت‌شده", unpaid: "پرداخت‌نشده", cancelled: "لغوشده", completed: "تکمیل‌شده", shipped: "ارسال‌شده", processing: "در حال پردازش", published: "منتشرشده", refunded: "مستردشده", failed: "ناموفق" };
  return Object.entries(value as Record<string, unknown>).filter(([key, val]) => DETAIL_LABELS[key] && ["string", "number", "boolean"].includes(typeof val) && val !== "").slice(0, 3).map(([key, val]) => {
    let rendered = typeof val === "boolean" ? (val ? "بله" : "خیر") : String(val);
    if (key === "status") rendered = statusLabels[rendered] ?? rendered;
    if (key === "role") rendered = ROLES[rendered as keyof typeof ROLES] ?? rendered;
    return [DETAIL_LABELS[key], rendered] as [string, string];
  });
}

export default async function Audit({ searchParams }: { searchParams: SearchParams }) {
  await requirePage({ perm: "AUDIT_LOG_VIEW" });
  const sp = await searchParams;
  const { page: requestedPage, pageSize, offset } = paginationParams(sp);
  const today = tehranDay(new Date());
  const to = validDate(sp.to) ? sp.to! : today;
  const from = validDate(sp.from) ? sp.from! : new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const startAt = new Date(`${from}T00:00:00+03:30`);
  const endAt = new Date(Date.parse(`${to}T00:00:00Z`) + 86400000 - 12600000);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const category = Object.hasOwn(CATEGORIES, sp.category ?? "") ? sp.category! : "";
  const entity = Object.hasOwn(ENTITIES, sp.entity ?? "") ? sp.entity! : "";
  const conditions: SQL[] = [gte(auditLogs.createdAt, startAt), lt(auditLogs.createdAt, endAt)];
  if (q) conditions.push(or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.entity, `%${q}%`), ilike(auditLogs.entityId, `%${q}%`), ilike(users.name, `%${q}%`))!);
  if (category) conditions.push(ilike(auditLogs.action, `${category}.%`));
  if (entity) conditions.push(eq(auditLogs.entity, entity));
  const where = and(...conditions);
  const [totalRow, dayRow] = await Promise.all([
    db.select({ total: count() }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId)).where(where),
    db.select({ total: count() }).from(auditLogs).where(gte(auditLogs.createdAt, new Date(Date.now() - 86400000))),
  ]);
  const total = Number(totalRow[0]?.total ?? 0);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const rows = await db.select({ event: auditLogs, actor: users.name, role: users.role }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId)).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(pageSize).offset((page - 1) * pageSize);

  return <div className="space-y-5">
    <PageHeader title="فعالیت و گزارش ممیزی" subtitle="رویدادهای ثبت‌شدهٔ مدیریتی و عملیاتی، همراه با عامل و پیوند به رکورد مربوط" actions={<Link href="/admin/audit" className="btn-ghost">پاک‌کردن فیلترها</Link>} />
    <FeatureIntro icon={ShieldCheck} tone="blue" title="نمایش امن رویدادها" text="این خوراک از لاگ‌های ممیزی موجود استفاده می‌کند. اطلاعات تماس، جزئیات کامل قبل/بعد، IP و مرورگر در فهرست نمایش داده نمی‌شوند؛ دسترسی فقط برای نقش دارای مجوز گزارش ممیزی است." />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Stat label="رخدادهای بازه" value={faNum(total)} icon={Activity} tone="blue" hint="با فیلترهای انتخاب‌شده" />
      <Stat label="رخدادهای ۲۴ ساعت اخیر" value={faNum(Number(dayRow[0]?.total ?? 0))} icon={ClipboardList} tone="green" />
      <Stat label="گروه‌های عملیات" value={faNum(Object.keys(CATEGORIES).length)} icon={ShieldCheck} tone="violet" hint="گروه‌های قابل فیلتر" />
    </section>
    <Card>
      <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto_auto] xl:items-end">
        <label className="text-xs text-slate-500">جستجو<div className="relative mt-1"><Search className="absolute right-3 top-2.5 size-4 text-slate-400"/><input className="input pr-9" name="q" defaultValue={q} placeholder="عامل، عملیات یا شناسهٔ رکورد"/></div></label>
        <label className="text-xs text-slate-500">گروه عملیات<select className="input mt-1" name="category" defaultValue={category}><option value="">همه گروه‌ها</option>{Object.entries(CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs text-slate-500">نوع مورد<select className="input mt-1" name="entity" defaultValue={entity}><option value="">همه موارد</option>{Object.entries(ENTITIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs text-slate-500">از تاریخ<div className="mt-1"><JalaliDatePicker name="from" defaultValue={from}/></div></label>
        <label className="text-xs text-slate-500">تا تاریخ<div className="mt-1"><JalaliDatePicker name="to" defaultValue={to}/></div></label>
        <input type="hidden" name="pageSize" value={pageSize}/>
        <button className="btn-primary"><Search className="size-4"/>اعمال</button>
        <Link href="/admin/audit" className="btn-ghost">۳۰ روز اخیر</Link>
      </form>
    </Card>
    <Card title={`رخدادها · ${faNum(total)}`}>
      {rows.length ? <div className="divide-y divide-slate-100">{rows.map(({event,actor,role})=>{
        const href=entityHref(event.entity,event.entityId), oldDetails=safeDetails(event.oldValue), newDetails=safeDetails(event.newValue);
        const summary=[...newDetails.map(([k,v])=>`${k}: ${v}`),...oldDetails.filter(([k])=>!newDetails.some(([nk])=>nk===k)).map(([k,v])=>`${k}: ${v}`)].slice(0,3);
        return <article key={event.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
          <time className="w-36 shrink-0 text-xs text-slate-500">{jdate(event.createdAt,true)}</time>
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity className="size-4"/></span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{labelForAction(event.action,event.entity)}</b><Badge tone="gray">{ENTITIES[event.entity]??event.entity}</Badge></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>عامل: <b className="text-slate-700">{actor??"سیستم"}</b></span>{role&&<span>نقش: {ROLES[role as keyof typeof ROLES]??role}</span>}<span>شناسه رخداد: {faNum(event.id)}</span></div>{summary.length>0&&<div className="mt-2 flex flex-wrap gap-1.5">{summary.map((item,index)=><span key={`${index}:${item}`} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{item}</span>)}</div>}</div>
          <div className="shrink-0">{href?<Link className="btn-sm" href={href}>مشاهده مورد<ArrowUpLeft className="size-3.5"/></Link>:<span className="text-xs text-slate-400">{event.entityId?`شناسه ${event.entityId}`:"بدون رکورد مرتبط"}</span>}</div>
        </article>;
      })}</div> : <div className="py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><ClipboardList className="size-6"/></span><b className="mt-3 block text-sm">رخدادی با این فیلترها پیدا نشد</b><p className="mt-1 text-xs text-slate-500">بازه یا عبارت جستجو را تغییر دهید.</p></div>}
    </Card>
    <Pagination page={page} pageSize={pageSize} total={total}/>
  </div>;
}
