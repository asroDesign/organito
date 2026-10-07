import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { productInquiries, productVariants, products, users } from "@/db/schema";

const pageSizes = [10, 25, 50, 100];
export async function getProductInquiryData(search: { q?: string; status?: string; page?: string; pageSize?: string }) {
  const status = ["new", "contacted", "closed", "converted"].includes(search.status ?? "") ? search.status! : "";
  const pageSize = pageSizes.includes(Number(search.pageSize)) ? Number(search.pageSize) : 25;
  const requestedPage = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const q = (search.q ?? "").trim().slice(0, 100);
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(productInquiries.status, status));
  if (q) conditions.push(or(ilike(productInquiries.customerName, `%${q}%`), ilike(productInquiries.phone, `%${q}%`), ilike(productInquiries.number, `%${q}%`), ilike(products.nameFa, `%${q}%`))!);
  const where = conditions.length ? and(...conditions) : undefined;
  const [{ total = 0 } = {}] = await db.select({ total: sql<number>`count(*)::int` }).from(productInquiries).innerJoin(products, eq(products.id, productInquiries.productId)).where(where);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(Number(total) / pageSize)));
  const [rows, statusCounts, operators] = await Promise.all([
    db.select({ inquiry: productInquiries, productName: products.nameFa, productSlug: products.slug, variantTitle: productVariants.title, operatorName: users.name }).from(productInquiries).innerJoin(products, eq(products.id, productInquiries.productId)).leftJoin(productVariants, eq(productVariants.id, productInquiries.variantId)).leftJoin(users, eq(users.id, productInquiries.assignedTo)).where(where).orderBy(desc(productInquiries.createdAt), desc(productInquiries.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ status: productInquiries.status, count: sql<number>`count(*)::int` }).from(productInquiries).groupBy(productInquiries.status),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(and(eq(users.isActive, true), inArray(users.role, ["super_admin", "marketplace_manager", "procurement_manager", "support", "catalog_manager"])) ).orderBy(asc(users.name)),
  ]);
  return { rows, total: Number(total), page, pageSize, q, status, counts: Object.fromEntries(statusCounts.map((x) => [x.status, Number(x.count)])) as Record<string, number>, operators };
}
