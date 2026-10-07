import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireApi } from "@/lib/auth";
import { HttpError, int, str } from "@/lib/util";
import { saveProduct } from "@/lib/services/catalog";
import { body, type Route } from "./router";

function sourceReference(value: unknown) {
  const raw = str(value, 400).trim();
  const idOnly = /^(?:dkp-)?(\d{3,20})$/i.exec(raw);
  if (idOnly) {
    const id = `dkp-${idOnly[1]}`;
    return { id, url: `https://www.digikala.com/product/${id}/` };
  }
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, "لینک یا شناسه محصول دیجی‌کالا معتبر نیست"); }
  if (url.protocol !== "https:" || !["digikala.com", "www.digikala.com"].includes(url.hostname.toLowerCase())) throw new HttpError(400, "فقط لینک امن از دامنه رسمی digikala.com پذیرفته می‌شود");
  const match = /^\/product\/(dkp-\d{3,20})(?:\/|$)/i.exec(url.pathname);
  if (!match) throw new HttpError(400, "شناسه محصول در مسیر لینک دیجی‌کالا پیدا نشد");
  const id = match[1].toLowerCase();
  return { id, url: `https://www.digikala.com/product/${id}/` };
}

export const productImportRoutes: Route[] = [
  { method: "POST", pattern: "admin/products/import-digikala", handler: async (req, _p, meta) => {
    const user = await requireApi("PRODUCTS_CREATE"), input = await body(req);
    if (input.rightsConfirmed !== true) throw new HttpError(400, "تأیید مجوز استفاده تجاری از محتوای واردشده الزامی است");
    const source = sourceReference(input.sourceReference);
    const categoryId = input.categoryId ? int(input.categoryId, 1) : null;
    if (categoryId) {
      const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId));
      if (!category) throw new HttpError(400, "دسته‌بندی انتخاب‌شده معتبر نیست");
    }
    const raw = input.product && typeof input.product === "object" && !Array.isArray(input.product) ? input.product as Record<string, unknown> : {};
    const nameFa = str(raw.nameFa, 200).trim(), brand = str(raw.brand, 80).trim();
    if (nameFa.length < 2 || brand.length < 1) throw new HttpError(400, "نام فارسی محصول و برند در اطلاعات واردشده الزامی است");
    const [duplicate] = await db.select({ id: products.id }).from(products).where(or(eq(products.externalSourceId, source.id), eq(products.sku, `DK-${source.id.toUpperCase()}`)));
    if (duplicate) throw new HttpError(409, `این شناسه قبلاً به محصول ${duplicate.id} پیوند خورده است`);
    const specs = Array.isArray(raw.specs) ? raw.specs.slice(0, 80).flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>, k = str(row.k ?? row.name, 80).trim(), v = str(row.v ?? row.value, 200).trim();
      return k && v ? [{ k, v, group: str(row.group, 80).trim() || undefined }] : [];
    }) : [];
    const product = {
      nameFa, nameEn: str(raw.nameEn, 200), brand, manufacturer: str(raw.manufacturer, 80), country: str(raw.country, 60),
      categoryId,
      sku: `DK-${source.id.toUpperCase()}`, partNumber: `DK-${source.id.toUpperCase()}`,
      externalSourceUrl: source.url, externalSourceId: source.id,
      shortDesc: str(raw.shortDesc, 500), description: str(raw.description, 100000),
      specs, weight: raw.weight ? int(raw.weight, 1, 1000000) : null,
      basePrice: 0, compareAtPrice: 0, imageIds: [], variants: [], options: [],
      inventoryBaseUnit: "عدد", lowStockThreshold: 3, status: "draft",
    };
    let result: { id: number };
    try {
      result = await saveProduct({ userId: user.id, ...meta }, user, product);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") throw new HttpError(409, "این منبع قبلاً برای محصول دیگری ثبت شده است");
      throw error;
    }
    return { id: result.id, sourceId: source.id, status: "draft", editorUrl: `/admin/products/${result.id}/edit` };
  } },
];
