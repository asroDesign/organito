import { AdminShellFrame } from "./AdminShellFrame";
import type { ReactNode } from "react";
import Link from "next/link";
import { and, eq, count } from "drizzle-orm";
import { NotificationBell } from "./NotificationBell";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { ROLES, type Permission } from "@/lib/rbac";
import { SideNav, type NavItem } from "./SideNav";
import { LogoutButton } from "./client";
import { getSettings } from "@/lib/settings";
import { SiteBrand } from "./SiteBrand";

const ADMIN_GROUPS: { label: string; icon: NavItem["icon"]; items: (NavItem & { perm?: Permission | Permission[] })[] }[] = [
  { label: "فروش و سفارش‌ها", icon: "ShoppingBag", items: [
    { href: "/admin/orders", label: "سفارش‌های آنلاین و حضوری", icon: "ShoppingBag", perm: "ORDERS_VIEW" },
    { href: "/admin/incomplete-carts", label: "سبدهای ناقص", icon: "AlertTriangle", perm: "SMS_MANAGE" },
    { href: "/admin/pos", label: "ثبت فروش حضوری", icon: "ShoppingBag", perm: "INVENTORY_MANAGE" },
    { href: "/admin/returns", label: "مرجوعی‌ها", icon: "ClipboardList", perm: "ORDERS_MANAGE" },
    { href: "/admin/shipments", label: "ارسال‌ها و مرسوله‌ها", icon: "Truck", perm: "SHIPMENTS_MANAGE" },
    { href: "/admin/carriers", label: "شرکت‌های پستی و تعرفه", icon: "MapPin", perm: "SHIPMENTS_MANAGE" },
    { href: "/admin/warehouse-issues", label: "حواله‌های خروج انبار", icon: "ClipboardList", perm: ["INVENTORY_MANAGE", "SHIPMENTS_MANAGE"] },
  ] },
  { label: "محصولات و محتوا", icon: "Package", items: [
    { href: "/admin/products", label: "محصولات و کاتالوگ", icon: "Package", perm: "PRODUCTS_VIEW" },
    { href: "/admin/product-prices", label: "ویرایش سریع قیمت‌ها", icon: "Tag", perm: "PRODUCTS_EDIT" },
    { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "FolderTree", perm: "PRODUCTS_EDIT" },
    { href: "/admin/reviews", label: "دیدگاه‌ها و پرسش‌ها", icon: "MessageSquare", perm: "PRODUCTS_APPROVE" },
    { href: "/admin/blog", label: "وبلاگ و سئو", icon: "FileText", perm: "PRODUCTS_EDIT" },
    { href: "/admin/home-builder", label: "صفحه‌ساز صفحه اصلی", icon: "LayoutDashboard", perm: "SETTINGS_MANAGE" },
    { href: "/admin/site-content", label: "صفحه‌ساز و منوهای فوتر", icon: "FileText", perm: "SETTINGS_MANAGE" },
    { href: "/admin/media", label: "مرکز فایل و رسانه", icon: "FileImage", perm: "PRODUCTS_EDIT" },
  ] },
  { label: "مشتریان و بازاریابی", icon: "Users", items: [
    { href: "/admin/loyalty", label: "باشگاه مشتریان", icon: "Users", perm: "SMS_MANAGE" },
    { href: "/admin/campaigns", label: "کمپین‌های تبلیغاتی", icon: "MessageSquare", perm: "SMS_MANAGE" },
    { href: "/admin/automations", label: "رویدادهای خودکار", icon: "Flame", perm: "SMS_MANAGE" },
    { href: "/admin/discounts", label: "کدهای تخفیف", icon: "BadgePercent", perm: "MARKETING_MANAGE" },
    { href: "/admin/festivals", label: "جشنواره‌های فروش", icon: "Flame", perm: "MARKETING_MANAGE" },
    { href: "/admin/giftcards", label: "کارت‌های هدیه", icon: "Tag", perm: "PAYMENTS_MANAGE" },
    { href: "/admin/sms", label: "پیامک و گزارش ارسال", icon: "MessageSquare", perm: "SMS_MANAGE" },
  ] },
  { label: "فروشندگان و تأمین", icon: "Store", items: [
    { href: "/admin/marketplace", label: "مدیریت فروشندگان", icon: "Store", perm: ["SUPPLIER_OFFERS_MANAGE", "SELLER_SETTLEMENT_MANAGE", "WITHDRAWALS_MANAGE"] },
    { href: "/admin/supply", label: "درخواست‌های استعلام و تأمین", icon: "Search", perm: "SUPPLY_REQUESTS_VIEW" },
  ] },
  { label: "مالی، انبار و پشتیبانی", icon: "Calculator", items: [
    { href: "/admin/accounting", label: "حسابداری و گزارش مالی", icon: "Calculator", perm: "ACCOUNTING_MANAGE" },
    { href: "/admin/customer-wallet", label: "برداشت کیف پول مشتریان", icon: "Wallet", perm: "WITHDRAWALS_MANAGE" },
    { href: "/admin/inventory", label: "موجودی انبار مرکزی", icon: "Warehouse", perm: "INVENTORY_MANAGE" },
    { href: "/admin/tickets", label: "تیکت‌ها و پشتیبانی", icon: "LifeBuoy", perm: "TICKETS_MANAGE" },
  ] },
  { label: "کاربران و تنظیمات سامانه", icon: "Settings", items: [
    { href: "/admin/users", label: "کاربران", icon: "Users", perm: "USERS_MANAGE" },
    { href: "/admin/access", label: "نقش‌ها، دسترسی و گروه‌ها", icon: "ShieldCheck", perm: ["USERS_MANAGE", "SMS_MANAGE"] },
    { href: "/admin/labels", label: "طراحی چاپ و لیبل", icon: "Tag", perm: "SETTINGS_MANAGE" },
    { href: "/admin/payment-gateways", label: "درگاه‌های پرداخت", icon: "Wallet", perm: "SETTINGS_MANAGE" },
    { href: "/admin/settings", label: "تنظیمات عمومی", icon: "Settings", perm: "SETTINGS_MANAGE" },
    { href: "/admin/audit", label: "گزارش ممیزی", icon: "ShieldCheck", perm: "AUDIT_LOG_VIEW" },
  ] },
];
const SELLER_NAV: NavItem[] = [
  { href: "/seller", label: "داشبورد", icon: "LayoutDashboard" },
  { href: "/seller/products", label: "محصولات و پیشنهادها", icon: "Package" },
  { href: "/seller/orders", label: "سفارش‌ها و مرسوله‌ها", icon: "Truck" },
  { href: "/seller/pos", label: "فروش حضوری", icon: "ShoppingBag" },
  { href: "/seller/loyalty", label: "باشگاه مشتریان", icon: "Users" },
  { href: "/seller/groups", label: "گروه‌های مشتریان", icon: "Users" },
  { href: "/seller/campaigns", label: "کمپین‌های تبلیغاتی", icon: "MessageSquare" },
  { href: "/seller/automations", label: "رویدادهای خودکار", icon: "Flame" },
  { href: "/seller/returns", label: "مرجوعی حضوری", icon: "ClipboardList" },
  { href: "/seller/warehouse-issues", label: "حواله‌های خروج انبار", icon: "ClipboardList" },
  { href: "/seller/rfq", label: "درخواست‌های RFQ", icon: "Search" },
  { href: "/seller/finance", label: "مالی و گزارش", icon: "Calculator" },
  { href: "/seller/wallet", label: "کیف پول و برداشت", icon: "Wallet" },
  { href: "/seller/profile", label: "پروفایل و مدارک", icon: "User" },
];
const CUSTOMER_NAV: NavItem[] = [
  { href: "/customer", label: "داشبورد", icon: "LayoutDashboard" },
  { href: "/customer/orders", label: "سفارش‌های من", icon: "ShoppingBag" },
  { href: "/customer/wallet", label: "کیف پول و حساب بانکی", icon: "Wallet" },
  { href: "/customer/addresses", label: "آدرس‌های من", icon: "MapPin" },
  { href: "/customer/favorites", label: "علاقه‌مندی‌های من", icon: "Heart" },
  { href: "/customer/referral", label: "دعوت دوستان و امتیاز", icon: "Users" },
  { href: "/customer/returns", label: "درخواست‌های مرجوعی", icon: "ClipboardList" },
  { href: "/customer/tracking", label: "پیگیری سفارش", icon: "Truck" },
  { href: "/customer/supply", label: "استعلام و تأمین محصول", icon: "Search" },
  { href: "/customer/tickets", label: "پشتیبانی", icon: "LifeBuoy" },
  { href: "/customer/profile", label: "پروفایل و امنیت", icon: "User" },
  { href: "/shop", label: "فروشگاه", icon: "Store" },
];

export async function Shell({ user, area, children }: { user: SessionUser; area: "admin" | "seller" | "customer"; children: ReactNode }) {
  const canSee = (n: NavItem & { perm?: Permission | Permission[] }) => !n.perm || (Array.isArray(n.perm) ? n.perm.some((p) => user.permissions.includes(p)) : user.permissions.includes(n.perm));
  const adminGroups = ADMIN_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee).map(({ href, label, icon }) => ({ href, label, icon })) })).filter((g) => g.items.length > 0);
  const items = area === "admin" ? [{ href: "/admin", label: "داشبورد", icon: "LayoutDashboard" as const }]
    : area === "seller" ? SELLER_NAV : CUSTOMER_NAV;
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  const settings = await getSettings();
  const title = area === "admin" ? "پنل مدیریت" : area === "seller" ? "پنل تأمین‌کننده" : "حساب کاربری";
  const side = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <SiteBrand name={settings.siteName} logoMediaId={Number(settings.siteLogoMediaId)} boxClassName="h-9 w-9" />
        <div><div className="font-black text-slate-800">{settings.siteName}</div><div className="text-[11px] text-slate-500">{title}</div></div>
      </Link>
      <SideNav items={items} groups={area === "admin" ? adminGroups : undefined} />
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          {user.avatarMediaId ? <img src={`/api/media/${user.avatarMediaId}`} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">{user.name.slice(0,1)}</span>}
          <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-700">{user.name}</div>
          <div className="text-xs text-slate-500">{ROLES[user.role as keyof typeof ROLES] ?? user.role}</div></div>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
  return (
    <AdminShellFrame content={children}><div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-l border-slate-200 bg-white lg:block">{side}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <SideNav items={items} groups={area === "admin" ? adminGroups : undefined} mobile title={title} footer={<div className="shrink-0 border-t border-slate-100 p-3"><LogoutButton /></div>} />
          <div className="hidden text-sm text-slate-500 lg:block">{title}</div>
          <div className="flex items-center gap-2">
            <NotificationBell initialUnread={n} />
            <Link href="/shop" className="btn-sm">فروشگاه</Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div></AdminShellFrame>
  );
}
