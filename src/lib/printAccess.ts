import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { orderItems, orders, sellers, sellerShipments, users } from "@/db/schema";
import { getUser } from "./auth";

/** Loads a shipment for printing with IDOR protection (staff / owning seller / owning customer). */
export async function loadShipmentForPrint(idRaw: string, kind: "invoice" | "label") {
  const u = await getUser();
  if (!u) redirect("/login");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [sh] = await db.select().from(sellerShipments).where(eq(sellerShipments.id, id));
  if (!sh) notFound();
  const [o] = await db.select().from(orders).where(eq(orders.id, sh.orderId));
  const staffOk = u.staff && u.permissions.includes(kind === "label" ? "SHIPMENTS_MANAGE" : "ORDERS_VIEW");
  const sellerOk = !!u.sellerId && sh.sellerId === u.sellerId;
  const customerOk = kind === "invoice" && o.customerId === u.id;
  if (!staffOk && !sellerOk && !customerOk) notFound();
  if (kind === "invoice" && o.paymentStatus !== "paid" && !staffOk) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.shipmentId, sh.id));
  const [seller] = sh.sellerId ? await db.select().from(sellers).where(eq(sellers.id, sh.sellerId)) : [];
  const [customer] = await db.select({ name: users.name, phone: users.phone, email: users.email }).from(users).where(eq(users.id, o.customerId));
  const pays = staffOk || customerOk ? await db.select().from(payments).where(eq(payments.orderId, o.id)) : [];
  return { u, sh, o, items, seller, customer, pays };
}

import { inArray } from "drizzle-orm";
import { payments } from "@/db/schema";
import type { SettingsShape } from "./settings";
import { faNum, jdate } from "./util";

export const PAY_METHOD: Record<string, string> = { gateway: "درگاه پرداخت اینترنتی", card_to_card: "کارت به کارت", bank_transfer: "حواله / واریز بانکی", cash: "نقدی", pos: "کارتخوان" };
export const PAY_STATUS: Record<string, string> = { success: "موفق", pending_verification: "در انتظار تأیید", rejected: "ردشده", refunded: "مسترد" };

/** Order-level print loader (staff with ORDERS_VIEW, owning customer, or seller — sellers only see their own shipments). */
export async function loadOrderForPrint(idRaw: string, kind: "order" | "labels") {
  const u = await getUser();
  if (!u) redirect("/login");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o) notFound();
  const staffOk = u.staff && u.permissions.includes(kind === "labels" ? "SHIPMENTS_MANAGE" : "ORDERS_VIEW");
  let shs = await db.select().from(sellerShipments).where(eq(sellerShipments.orderId, o.id));
  if (!staffOk) {
    if (u.sellerId && shs.some((s) => s.sellerId === u.sellerId)) shs = shs.filter((s) => s.sellerId === u.sellerId);
    else if (!(kind === "order" && o.customerId === u.id)) notFound();
  }
  shs = shs.filter((s) => s.status !== "cancelled" || o.status === "cancelled");
  const items = shs.length ? await db.select().from(orderItems).where(inArray(orderItems.shipmentId, shs.map((s) => s.id))) : [];
  const sellerIds = shs.map((s) => s.sellerId).filter(Boolean) as number[];
  const sellerList = sellerIds.length ? await db.select().from(sellers).where(inArray(sellers.id, sellerIds)) : [];
  const [customer] = await db.select({ name: users.name, phone: users.phone, email: users.email }).from(users).where(eq(users.id, o.customerId));
  const pays = staffOk || o.customerId === u.id ? await db.select().from(payments).where(eq(payments.orderId, o.id)) : [];
  return { u, o, shs, items, sellers: sellerList, customer, pays, staffOk };
}

export function labelData(s: SettingsShape, o: typeof orders.$inferSelect, sh: typeof sellerShipments.$inferSelect, seller?: typeof sellers.$inferSelect) {
  return {
    receiver: o.address.fullName, phone: o.address.phone, city: o.address.city, address: o.address.address, postalCode: o.address.postalCode || "—",
    order: o.number, shipment: String(sh.id), carrier: sh.carrier ?? "—", tracking: sh.trackingNumber ?? "—", packages: faNum(sh.packageCount),
    sender: seller?.shopName ?? s.senderName, senderAddress: seller ? `${seller.city}` : `${s.senderCity} - ${s.senderAddress}`,
    senderPhone: seller ? "" : s.senderPhone, senderPostalCode: seller ? "" : s.senderPostalCode, date: jdate(new Date()),
    total: `${faNum(o.total)} تومان`, payment: o.paymentStatus === "paid" ? "پرداخت‌شده" : "پرداخت‌نشده",
    barcode: sh.trackingNumber && /^[A-Za-z0-9\- .]+$/.test(sh.trackingNumber) ? sh.trackingNumber : `${o.number}-${sh.id}`,
  };
}
