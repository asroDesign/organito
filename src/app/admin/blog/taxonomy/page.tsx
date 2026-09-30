import { asc } from "drizzle-orm";
import { FileText, Search, Tags } from "lucide-react";
import BlogTaxonomyManager from "@/components/BlogTaxonomyManager";
import { FeatureIntro, PageHeader, PanelTabs } from "@/components/ui";
import { db } from "@/db";
import { blogCategories, blogTags } from "@/db/schema";
import { requirePage } from "@/lib/auth";

export default async function BlogTaxonomyPage() {
  const user = await requirePage({ perm: "PRODUCTS_EDIT" });
  const [categories, tags] = await Promise.all([
    db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
    db.select().from(blogTags).orderBy(asc(blogTags.name)),
  ]);
  return <><PageHeader title="دسته‌ها و برچسب‌های وبلاگ" subtitle="ساختار موضوعی مقاله‌ها را از یک محل مدیریت کنید" /><PanelTabs items={[{ href: "/admin/blog", label: "مقالات", icon: FileText }, { href: "/admin/blog/taxonomy", label: "دسته‌ها و برچسب‌ها", active: true, icon: Tags }, ...(user.permissions.includes("SETTINGS_MANAGE") ? [{ href: "/admin/blog/seo", label: "تنظیمات سئوی صفحات", icon: Search }] : [])]} /><FeatureIntro className="my-5" icon={Tags} title="ساختار محتوایی وبلاگ" text="دسته‌ها در فرم مقاله انتخاب می‌شوند و برچسب‌ها برای هر نوشته به‌صورت چندانتخابی قابل ثبت هستند." /><BlogTaxonomyManager initialCategories={categories} initialTags={tags} /></>;
}
