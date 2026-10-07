import { asc } from "drizzle-orm";
import { FileText, Search, Tags } from "lucide-react";
import BlogTaxonomyManager from "@/components/BlogTaxonomyManager";
import { FeatureIntro, PageHeader, PanelTabs } from "@/components/ui";
import { db } from "@/db";
import { blogCategories, blogPosts, blogTags } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { slugify } from "@/lib/util";

export default async function BlogTaxonomyPage() {
  const user = await requirePage({ perm: "PRODUCTS_EDIT" });
  const [categories, tags, posts] = await Promise.all([
    db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
    db.select().from(blogTags).orderBy(asc(blogTags.name)),
    db.select({ tags: blogPosts.tags }).from(blogPosts),
  ]);
  const tagNames = Array.from(new Set(posts.flatMap((post) => post.tags)));
  const savedTagNames = new Set(tags.map((tag) => tag.name));
  const allTags = [...tags.map((tag) => ({ ...tag, persisted: true })), ...tagNames.filter((name) => !savedTagNames.has(name)).map((name, index) => ({ id: -(index + 1), name, slug: slugify(name), seoTitle: null, metaDescription: null, seoKeywords: null, canonicalUrl: null, persisted: false }))];
  return <><PageHeader title="دسته‌ها و برچسب‌های وبلاگ" subtitle="ساختار موضوعی مقاله‌ها را از یک محل مدیریت کنید" /><PanelTabs items={[{ href: "/admin/blog", label: "مقالات", icon: FileText }, { href: "/admin/blog/taxonomy", label: "دسته‌ها و برچسب‌ها", active: true, icon: Tags }, ...(user.permissions.includes("SETTINGS_MANAGE") ? [{ href: "/admin/blog/seo", label: "تنظیمات سئوی صفحات", icon: Search }] : [])]} /><FeatureIntro className="my-5" icon={Tags} title="ساختار محتوایی وبلاگ" text="دسته‌ها در فرم مقاله انتخاب می‌شوند و برچسب‌ها برای هر نوشته به‌صورت چندانتخابی قابل ثبت هستند." /><BlogTaxonomyManager initialCategories={categories} initialTags={allTags} /></>;
}
