import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { CategoryManager } from "@/components/CategoryManager";

export default async function CategoriesPage() {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const r = await db.execute(sql`select c.id, c.name, c.slug, c.parent_id, c.description, c.seo_title, c.meta_description, c.seo_keywords, c.canonical_url, c.faqs, c.sort_order,
    (select count(*) from products p where p.category_id = c.id and p.status <> 'deleted')::int as products from categories c order by c.sort_order, c.id`);
  const rows = (r.rows as { id: number; name: string; slug: string; parent_id: number | null; description: string | null; seo_title: string | null; meta_description: string | null; seo_keywords: string | null; canonical_url: string | null; faqs: { question: string; answer: string }[]; sort_order: number; products: number }[])
    .map((x) => ({ id: x.id, name: x.name, slug: x.slug, parentId: x.parent_id, description: x.description, seoTitle: x.seo_title, metaDescription: x.meta_description, seoKeywords: x.seo_keywords, canonicalUrl: x.canonical_url, faqs: x.faqs ?? [], sortOrder: x.sort_order, products: x.products }));
  return (
    <>
      <PageHeader title="دسته‌بندی محصولات" subtitle="ساختار کاتالوگ، محتوای راهنما، سئو و سؤالات متداول هر دسته" />
      <Card><CategoryManager rows={rows} /></Card>
    </>
  );
}
