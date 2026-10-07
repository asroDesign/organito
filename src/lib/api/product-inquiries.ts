import { and, eq, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { orders, productInquiries, products, productVariants, users } from "@/db/schema";
import { audit } from "../audit";
import { getUser, rateLimit, requireApi } from "../auth";
import { genNumber, HttpError, int, str } from "../util";
import { body, idParam, type Route } from "./router";

function cleanPhone(value: unknown) {
  let phone = str(value, 24).replace(/[۰-۹]/g, (n) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(n))).replace(/[٠-٩]/g, (n) => String("٠١٢٣٤٥٦٧٨٩".indexOf(n))).replace(/[\s()-]/g, "");
  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  if (phone.startsWith("0098")) phone = "0" + phone.slice(4);
  if (!/^09\d{9}$/.test(phone)) throw new HttpError(400, "شماره موبایل معتبر وارد کنید");
  return phone;
}

export const productInquiryRoutes: Route[] = [
  { method: "POST", pattern: "product-inquiries", handler: async (req, _p, meta) => {
    rateLimit(`product-inquiry-ip:${meta.ip}`, 8, 15 * 60_000);
    const b = await body(req), productId = int(b.productId, 1), variantId = b.variantId ? int(b.variantId, 1) : null;
    const name = str(b.name, 100).trim(), phone = cleanPhone(b.phone), message = str(b.message, 1500).trim() || null;
    if (name.length < 2) throw new HttpError(400, "نام و نام خانوادگی را وارد کنید");
    if (b.consent !== true) throw new HttpError(400, "رضایت برای تماس درباره این درخواست الزامی است");
    rateLimit(`product-inquiry-phone:${phone}`, 3, 60 * 60_000);
    const [product] = await db.select().from(products).where(and(eq(products.id, productId), isNull(products.deletedAt)));
    if (!product || !["active", "out_of_stock"].includes(product.status)) throw new HttpError(404, "محصول در دسترس نیست");
    let variant: typeof productVariants.$inferSelect | undefined;
    if (variantId) {
      [variant] = await db.select().from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId), eq(productVariants.isActive, true), isNull(productVariants.deletedAt)));
      if (!variant) throw new HttpError(400, "تنوع انتخاب‌شده دیگر در دسترس نیست");
    }
    if (!product.inquiryOnly && !variant?.inquiryOnly) throw new HttpError(400, "برای این محصول استعلام تلفنی فعال نیست");
    const user = await getUser();
    const [row] = await db.insert(productInquiries).values({ number: genNumber("PI"), productId, variantId, userId: user?.id ?? null, customerName: name, phone, message, consentAt: new Date() }).returning({ id: productInquiries.id, number: productInquiries.number });
    await audit(db, { userId: user?.id ?? null, ...meta }, "product_inquiry.create", "product_inquiry", row.id, null, { number: row.number, productId, variantId, phone });
    return row;
  } },
  { method: "POST", pattern: "admin/product-inquiries/:id", handler: async (req, p, meta) => {
    const actor = await requireApi("PRODUCTS_EDIT"), id = idParam(p.id), b = await body(req);
    const [old] = await db.select().from(productInquiries).where(eq(productInquiries.id, id));
    if (!old) throw new HttpError(404, "درخواست استعلام پیدا نشد");
    const status = ["new", "contacted", "closed", "converted"].includes(String(b.status)) ? String(b.status) : old.status;
    const assignedTo = b.assignedTo ? int(b.assignedTo, 1) : null;
    if (assignedTo) {
      const [operator] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, assignedTo), eq(users.isActive, true), notInArray(users.role, ["customer", "seller"])));
      if (!operator) throw new HttpError(400, "اپراتور انتخاب‌شده فعال نیست");
    }
    const convertedOrderId = b.convertedOrderId ? int(b.convertedOrderId, 1) : null;
    if (status === "converted") {
      if (!convertedOrderId) throw new HttpError(400, "برای تبدیل استعلام به سفارش، شناسه سفارش را وارد کنید");
      const [matchedOrder] = await db.select({ id: orders.id }).from(orders).innerJoin(users, eq(users.id, orders.customerId)).where(and(eq(orders.id, convertedOrderId), eq(users.phone, old.phone)));
      if (!matchedOrder) throw new HttpError(400, "سفارش پیدا نشد یا شماره تماس مشتری با درخواست مطابقت ندارد");
    }
    const values = { status, assignedTo, internalNote: str(b.internalNote, 3000).trim() || null, convertedOrderId: status === "converted" ? convertedOrderId : null, updatedAt: new Date() };
    const [updated] = await db.update(productInquiries).set(values).where(eq(productInquiries.id, id)).returning();
    await audit(db, { userId: actor.id, ...meta }, "product_inquiry.update", "product_inquiry", id, { status: old.status, assignedTo: old.assignedTo }, { status, assignedTo, convertedOrderId: updated.convertedOrderId });
    revalidatePath("/admin/product-inquiries");
    return updated;
  } },
];
