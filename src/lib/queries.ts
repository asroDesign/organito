import { and, eq, ilike, inArray, or, sql, desc, asc, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { normalizePn } from "./util";
import { activeFestivals, applyPct, festivalFor } from "./marketing";
import { getSettings } from "./settings";

export type ShopFilters = { ids?: number[]; q?: string; cat?: string; auth?: string; brand?: string; stock?: string; sort?: string; min?: string; max?: string; make?: string; page?: string; fest?: string };

export async function listShopProducts(f: ShopFilters, limit = 200) {
  const conds: SQL[] = [inArray(products.status, ["active", "out_of_stock"])];
  if (f.ids?.length) conds.push(inArray(products.id, f.ids));
  if (f.q) {
    const like = `%${f.q}%`;
    const pn = normalizePn(f.q);
    const c = or(ilike(products.nameFa, like), ilike(products.nameEn, like), ilike(products.brand, like), ilike(products.sku, like),
      pn ? sql`${products.normalizedPn} like ${"%" + pn + "%"}` : undefined,
      pn ? sql`upper(regexp_replace(coalesce(${products.oemNumber},''), '[^A-Za-z0-9]', '', 'g')) like ${"%" + pn + "%"}` : undefined,
      pn ? sql`exists (select 1 from jsonb_array_elements_text(${products.crossRefs}) x where upper(regexp_replace(x, '[^A-Za-z0-9]', '', 'g')) like ${"%" + pn + "%"})` : undefined);
    if (c) conds.push(c);
  }
  if (f.cat) {
    const id = Number(f.cat) || 0;
    conds.push(sql`(${products.categoryId} = ${id} or ${products.categoryId} in (select id from categories where parent_id = ${id}))`);
  }
  if (f.auth) conds.push(eq(products.authenticity, f.auth));
  if (f.brand) conds.push(eq(products.brand, f.brand));
  if (f.make) conds.push(sql`(${products.organicInfo}->'suitableFor') ? ${f.make}`);
  const offerAgg = sql`(select json_build_object('min', min(coalesce(o.sale_price, o.price)), 'max', max(coalesce(o.sale_price, o.price)), 'sellers', count(*), 'avail', coalesce(sum(greatest(o.stock - o.reserved, 0)),0), 'rating', max(s.rating))
    from seller_offers o join sellers s on s.id = o.seller_id where o.product_id = ${products.id} and o.status = 'approved' and s.status = 'approved' and not s.restricted)`;
  const varAgg = sql`(select json_build_object('min', min(v.price) filter (where v.is_sellable), 'avail', coalesce(sum(greatest(v.on_hand - v.reserved,0)) filter (where v.is_sellable),0), 'has', count(*) > 0, 'sellable', count(*) filter (where v.is_sellable) > 0) from product_variants v where v.product_id = ${products.id} and v.is_active)`;
  const rev = sql<{ avg: number | null; n: number }>`(select json_build_object('avg', round(avg(r.rating)::numeric, 1), 'n', count(*)) from reviews r where r.product_id = ${products.id} and r.status = 'approved')`;
  const sold = sql<number>`(select coalesce(sum(oi.qty),0)::int from order_items oi join orders o on o.id = oi.order_id where oi.product_id = ${products.id} and o.payment_status = 'paid')`;
  const rows = await db.select({ p: products, agg: sql<{ min: number | null; max: number | null; sellers: number; avail: number; rating: number | null }>`${offerAgg}`, va: sql<{ min: number | null; avail: number; has: boolean; sellable: boolean }>`${varAgg}`, sold, rev, cat: categories.name })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId)).where(and(...conds))
    .orderBy(f.sort === "new" ? desc(products.createdAt) : desc(products.updatedAt)).limit(limit);
  const [fests, st] = await Promise.all([activeFestivals(), getSettings()]);
  const mv = !!st.multiVendor;
  let list = rows.map(({ p, agg, va, sold, rev, cat }) => {
    const hasVar = !!va.has;
    const hasSellableVariant = !!va.sellable;
    const centralAvail = p.source === "central" ? (hasVar ? Number(va.avail) : Math.max(0, p.onHand - p.reserved)) : 0;
    const prices = [...(p.source === "central" && (hasVar ? va.min : p.basePrice) ? [Number(hasVar ? va.min : p.basePrice)] : []), ...(agg.min ? [Number(agg.min), Number(agg.max)] : [])];
    const available = centralAvail + Number(agg.avail);
    const fest = festivalFor(fests, p.id, p.categoryId);
    const minList = prices.length ? Math.min(...prices) : 0;
    const minPrice = fest ? applyPct(minList, fest.discountPercent) : minList;
    const compareAt = fest ? minList : p.compareAtPrice > minList ? p.compareAtPrice : 0;
    return {
      id: p.id, slug: p.slug, nameFa: p.nameFa, brand: p.brand, sku: p.sku, partNumber: p.partNumber, authenticity: p.authenticity, country: p.country, categoryId: p.categoryId,
      imageId: p.mainImageId, category: cat, minPrice, listPrice: minList, maxPrice: prices.length ? Math.max(...prices) : 0, compareAt,
      discountPct: compareAt > minPrice && compareAt ? Math.round(((compareAt - minPrice) / compareAt) * 100) : 0,
      festival: fest ? { title: fest.title, color: fest.color, endsAt: fest.endsAt.toISOString(), pct: fest.discountPercent } : null,
      sellers: Number(agg.sellers) + (p.source === "central" ? 1 : 0), available, allowBackorder: p.source === "central" && p.allowBackorder && (!hasVar || hasSellableVariant), inStock: (available > 0 || (p.source === "central" && p.allowBackorder && (!hasVar || hasSellableVariant))) && (p.status === "active" || (p.status === "out_of_stock" && p.allowBackorder && (!hasVar || hasSellableVariant))), sold: Number(sold), rating: rev?.avg ? Number(rev.avg) : 0, reviewCount: Number(rev?.n ?? 0), sellerRating: agg.rating ?? 0, suitableFor: p.organicInfo?.suitableFor ?? [],
      createdAt: p.createdAt.toISOString(), hasVariants: hasVar, mv,
    };
  });
  if (f.stock === "in") list = list.filter((x) => x.inStock);
  if (f.stock === "out") list = list.filter((x) => !x.inStock);
  if (f.fest) list = list.filter((x) => x.festival);
  const min = Number(f.min) || 0, max = Number(f.max) || 0;
  if (min) list = list.filter((x) => x.minPrice >= min);
  if (max) list = list.filter((x) => x.minPrice <= max);
  if (f.sort === "price_asc") list.sort((a, b) => a.minPrice - b.minPrice);
  if (f.sort === "price_desc") list.sort((a, b) => b.minPrice - a.minPrice);
  if (f.sort === "best") list.sort((a, b) => b.sold - a.sold);
  if (f.sort === "discount") list.sort((a, b) => b.discountPct - a.discountPct);
  if (!f.sort || f.sort === "relevance") list.sort((a, b) => Number(b.inStock) - Number(a.inStock));
  return list;
}
export type ShopProduct = Awaited<ReturnType<typeof listShopProducts>>[number];

/** Diet / suitability tags from organic product profiles (used by the homepage finder & shop filter). */
export async function vehicleMakes() {
  const r = await db.execute(sql`select t as tag, count(*)::int as n from products p, jsonb_array_elements_text(coalesce(p.organic_info->'suitableFor', '[]'::jsonb)) t where p.status in ('active','out_of_stock') group by t order by n desc, t limit 30`);
  return (r.rows as { tag: string; n: number }[]).map((x) => ({ make: x.tag, models: [] as string[] }));
}

export async function categoriesWithCounts() {
  const r = await db.execute(sql`select c.id, c.name, c.slug, c.parent_id, c.description, c.seo_title, c.meta_description, c.seo_keywords, c.canonical_url, c.faqs, (select count(*) from products p where (p.category_id = c.id or p.category_id in (select id from categories x where x.parent_id = c.id)) and p.status in ('active','out_of_stock'))::int as n, (select main_image_id from products p where p.category_id = c.id and p.main_image_id is not null limit 1) as img from categories c order by c.sort_order, c.id`);
  return (r.rows as { id: number; name: string; slug: string; parent_id: number | null; description: string | null; seo_title: string | null; meta_description: string | null; seo_keywords: string | null; canonical_url: string | null; faqs: { question: string; answer: string }[]; n: number; img: number | null }[]);
}

export async function categoryOptions() {
  const all = await db.select().from(categories).orderBy(categories.sortOrder, categories.id);
  const path = (c: (typeof all)[number], guard = 0): string => {
    const parent = c.parentId ? all.find((x) => x.id === c.parentId) : undefined;
    return parent && guard < 5 ? `${path(parent, guard + 1)} › ${c.name}` : c.name;
  };
  return all.map((c) => ({ id: c.id, name: path(c) })).sort((a, b) => a.name.localeCompare(b.name, "fa"));
}
