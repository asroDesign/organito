import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, brands } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { BrandManager } from "@/components/BrandManager";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { Tags } from "lucide-react";

export default async function AdminBrandsPage() {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const [brandRows, posts] = await Promise.all([
    db.select({ brand: brands, productCount: sql<number>`(select count(*)::int from products p where lower(regexp_replace(btrim(p.brand), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(${brands.name}), '\\s+', ' ', 'g')) and p.status <> 'deleted')` }).from(brands).where(isNull(brands.deletedAt)).orderBy(brands.sortOrder, brands.name),
    db.select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.status, "published")).orderBy(desc(blogPosts.publishedAt)).limit(200),
  ]);
  const initial = brandRows.map(({ brand, productCount }) => ({ ...brand, productCount: Number(productCount), relatedBlogPostIds: brand.relatedBlogPostIds ?? [], seoKeywords: brand.seoKeywords ?? [] }));
  return <>
    <PageHeader title="مدیریت برندها" subtitle="صفحه‌های اختصاصی، هویت بصری، مقاله‌های مرتبط و تنظیمات جست‌وجو" />
    <FeatureIntro className="mb-5" icon={Tags} title="صفحات اختصاصی برند" text="هر برند صفحهٔ عمومی و نشانی مستقل دارد. محصولات قدیمی از روی نام برند به‌صورت خودکار در صفحهٔ همان برند قرار می‌گیرند." />
    <BrandManager initial={initial} posts={posts}/>
  </>;
}
