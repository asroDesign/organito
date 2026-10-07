export const PERMISSIONS = [
  "PRODUCTS_VIEW", "PRODUCTS_CREATE", "PRODUCTS_EDIT", "PRODUCTS_APPROVE", "PRODUCTS_DISABLE",
  "ORDERS_VIEW", "ORDERS_MANAGE", "SUPPLY_REQUESTS_VIEW", "SUPPLY_REQUESTS_MANAGE", "SUPPLIER_OFFERS_MANAGE",
  "INVENTORY_MANAGE", "SHIPMENTS_MANAGE", "PAYMENTS_MANAGE", "ACCOUNTING_MANAGE", "SELLER_SETTLEMENT_MANAGE",
  "WITHDRAWALS_MANAGE", "TICKETS_MANAGE", "SMS_MANAGE", "SETTINGS_MANAGE", "AUDIT_LOG_VIEW", "USERS_MANAGE", "MARKETING_MANAGE", "BLOG_PUBLISH",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = {
  customer: "مشتری",
  seller: "تأمین‌کننده",
  super_admin: "مدیر کل",
  marketplace_manager: "مدیر مارکت‌پلیس",
  procurement_manager: "مدیر خرید و تأمین",
  warehouse_manager: "مدیر انبار",
  accountant: "حسابدار",
  support: "پشتیبان مشتریان",
  catalog_manager: "مدیر محتوا و کاتالوگ",
} as const;
export type Role = keyof typeof ROLES;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  seller: [],
  super_admin: [...PERMISSIONS],
  marketplace_manager: ["MARKETING_MANAGE", "PRODUCTS_VIEW", "PRODUCTS_APPROVE", "PRODUCTS_DISABLE", "SUPPLIER_OFFERS_MANAGE", "SELLER_SETTLEMENT_MANAGE", "WITHDRAWALS_MANAGE", "ORDERS_VIEW", "SHIPMENTS_MANAGE"],
  procurement_manager: ["PRODUCTS_VIEW", "SUPPLY_REQUESTS_VIEW", "SUPPLY_REQUESTS_MANAGE", "SUPPLIER_OFFERS_MANAGE", "ORDERS_VIEW"],
  warehouse_manager: ["PRODUCTS_VIEW", "INVENTORY_MANAGE", "SHIPMENTS_MANAGE", "ORDERS_VIEW", "ORDERS_MANAGE"],
  accountant: ["ACCOUNTING_MANAGE", "PAYMENTS_MANAGE", "SELLER_SETTLEMENT_MANAGE", "WITHDRAWALS_MANAGE", "ORDERS_VIEW"],
  support: ["TICKETS_MANAGE", "ORDERS_VIEW", "SUPPLY_REQUESTS_VIEW", "PRODUCTS_VIEW"],
  catalog_manager: ["PRODUCTS_VIEW", "PRODUCTS_CREATE", "PRODUCTS_EDIT", "PRODUCTS_APPROVE", "PRODUCTS_DISABLE"],
};

export function permissionsOf(role: string, extra: string[] = []): Permission[] {
  const base = ROLE_PERMISSIONS[role as Role] ?? [];
  return Array.from(new Set([...base, ...(extra.filter((p) => (PERMISSIONS as readonly string[]).includes(p)) as Permission[])]));
}

export function isStaff(role: string) {
  return role !== "customer" && role !== "seller";
}

export const PERMISSION_LABELS:Record<Permission,string>={PRODUCTS_VIEW:'مشاهده محصولات',PRODUCTS_CREATE:'ثبت محصول',PRODUCTS_EDIT:'ویرایش محصول',PRODUCTS_APPROVE:'تأیید محصول',PRODUCTS_DISABLE:'غیرفعال‌سازی محصول',ORDERS_VIEW:'مشاهده سفارش‌ها',ORDERS_MANAGE:'مدیریت سفارش و مرجوعی',SUPPLY_REQUESTS_VIEW:'مشاهده تأمین',SUPPLY_REQUESTS_MANAGE:'مدیریت تأمین',SUPPLIER_OFFERS_MANAGE:'پیشنهادهای تأمین‌کنندگان',INVENTORY_MANAGE:'انبار و فروش حضوری',SHIPMENTS_MANAGE:'مدیریت ارسال',PAYMENTS_MANAGE:'پرداخت و کارت هدیه',ACCOUNTING_MANAGE:'حسابداری',SELLER_SETTLEMENT_MANAGE:'تسویه فروشنده',WITHDRAWALS_MANAGE:'برداشت‌ها',TICKETS_MANAGE:'تیکت‌ها',SMS_MANAGE:'پیامک، باشگاه و کمپین‌ها',SETTINGS_MANAGE:'تنظیمات',AUDIT_LOG_VIEW:'گزارش ممیزی',USERS_MANAGE:'کاربران و گروه‌های دسترسی',MARKETING_MANAGE:'کد تخفیف و جشنواره',BLOG_PUBLISH:'بازبینی و انتشار مقاله'};
