import { BlogPostForm } from "@/components/BlogPostForm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { blogCategories, blogTags } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";

export default async function NewBlogPostPage() {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const [categories, tags] = await Promise.all([
    db.select({ name: blogCategories.name }).from(blogCategories).where(eq(blogCategories.isActive, true)).orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
    db.select({ name: blogTags.name }).from(blogTags).orderBy(asc(blogTags.name)),
  ]);
  return <><PageHeader title="نوشته جدید" subtitle="مقاله‌ای جامع، خوانا و بهینه برای جست‌وجو ایجاد کنید" /><BlogPostForm categories={categories.map((x) => x.name)} availableTags={tags.map((x) => x.name)} /></>;
}
