export const PERMISSIONS = [
  "PRODUCTS_VIEW", "PRODUCTS_CREATE", "PRODUCTS_EDIT", "PRODUCTS_APPROVE", "PRODUCTS_DISABLE",
  "ORDERS_VIEW", "ORDERS_MANAGE", "SUPPLY_REQUESTS_VIEW", "SUPPLY_REQUESTS_MANAGE", "SUPPLIER_OFFERS_MANAGE",
  "INVENTORY_MANAGE", "SHIPMENTS_MANAGE", "PAYMENTS_MANAGE", "ACCOUNTING_MANAGE", "SELLER_SETTLEMENT_MANAGE",
  "WITHDRAWALS_MANAGE", "TICKETS_MANAGE", "SMS_MANAGE", "SETTINGS_MANAGE", "AUDIT_LOG_VIEW", "USERS_MANAGE", "MARKETING_MANAGE",
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
