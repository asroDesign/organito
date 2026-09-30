import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { blogCategories, blogPosts, blogTags } from "@/db/schema";
import { BlogPostForm } from "@/components/BlogPostForm";
import { PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage({ perm: "PRODUCTS_EDIT" });
  const { id } = await params;
  const [[post], categories, tags] = await Promise.all([
    db.select().from(blogPosts).where(eq(blogPosts.id, Number(id))).limit(1),
    db.select({ name: blogCategories.name }).from(blogCategories).where(eq(blogCategories.isActive, true)).orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name)),
    db.select({ name: blogTags.name }).from(blogTags).orderBy(asc(blogTags.name)),
  ]);
  if (!post) notFound();
  return <><PageHeader title={`ویرایش: ${post.title}`} subtitle="محتوا، تصویر و اطلاعات سئوی نوشته" /><BlogPostForm initial={post} categories={categories.map((x) => x.name)} availableTags={tags.map((x) => x.name)} /></>;
}
