import { and, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { blogPosts, blogTags, contentPages, users } from "@/db/schema";
import { slugify } from "@/lib/util";
import { PUBLIC_BLOG_TAG, PUBLIC_SITE_PAGES_TAG } from "@/lib/public-cache";

function revivePostDates<T extends { createdAt: Date; updatedAt: Date; publishedAt: Date | null }>(post: T): T {
  return { ...post, createdAt: new Date(String(post.createdAt)), updatedAt: new Date(String(post.updatedAt)), publishedAt: post.publishedAt ? new Date(String(post.publishedAt)) : null };
}

const readBlogIndex = unstable_cache(async () => {
  const rows = await db.select({ post: blogPosts, author: users.name, authorAvatar: users.avatarMediaId }).from(blogPosts).leftJoin(users, eq(users.id, blogPosts.authorId))
    .where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))).orderBy(desc(blogPosts.publishedAt));
  const all = rows.map(({ post, author, authorAvatar }) => ({ ...post, author, authorAvatar }));
  const tagNames = Array.from(new Set(all.flatMap((post) => post.tags)));
  const savedTags = tagNames.length ? await db.select({ name: blogTags.name, slug: blogTags.slug }).from(blogTags).where(inArray(blogTags.name, tagNames)).orderBy(blogTags.name) : [];
  const savedNames = new Set(savedTags.map((tag) => tag.name));
  const tags = [...savedTags, ...tagNames.filter((name) => !savedNames.has(name)).map((name) => ({ name, slug: slugify(name) }))].sort((a, b) => a.name.localeCompare(b.name, "fa"));
  return { posts: all, tags, categories: Array.from(new Set(all.map((post) => post.category))) };
}, ["public-blog-index-v1"], { tags: [PUBLIC_BLOG_TAG], revalidate: 300 });

export async function getPublishedBlogIndex() {
  const index = await readBlogIndex();
  return { ...index, posts: index.posts.map(revivePostDates) };
}

export async function getPublishedBlogPost(slug: string) {
  const row = await unstable_cache(async () => {
    const [row] = await db.select({ post: blogPosts, author: users.name, authorAvatar: users.avatarMediaId }).from(blogPosts).leftJoin(users, eq(users.id, blogPosts.authorId))
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()))).limit(1);
    return row ?? null;
  }, ["public-blog-post-v1", slug], { tags: [PUBLIC_BLOG_TAG], revalidate: 300 })();
  return row ? { ...row, post: revivePostDates(row.post) } : null;
}

export async function getRelatedPublishedBlogPosts(category: string, postId: number) {
  const posts = await unstable_cache(async () => db.select().from(blogPosts)
    .where(and(eq(blogPosts.status, "published"), eq(blogPosts.category, category), ne(blogPosts.id, postId), lte(blogPosts.publishedAt, new Date())))
    .orderBy(desc(blogPosts.publishedAt)).limit(3), ["public-blog-related-v1", category, String(postId)],
  { tags: [PUBLIC_BLOG_TAG], revalidate: 300 })();
  return posts.map(revivePostDates);
}

export async function getPublishedSitePage(slug: string) {
  return unstable_cache(async () => {
    const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.status, "published")));
    return page ?? null;
  }, ["public-site-page-v1", slug], { tags: [PUBLIC_SITE_PAGES_TAG], revalidate: 300 })();
}

export async function getPublishedBlogTagArchive(slug: string) {
  const archive = await unstable_cache(async () => {
    const decodedSlug = decodeURIComponent(slug);
    const [savedTag] = await db.select().from(blogTags).where(eq(blogTags.slug, decodedSlug)).limit(1);
    let tag = savedTag;
    if (!tag) {
      const index = await readBlogIndex();
      const name = Array.from(new Set(index.posts.flatMap((post) => post.tags))).find((value) => slugify(value) === decodedSlug);
      if (name) tag = { id: 0, name, slug: decodedSlug, seoTitle: null, metaDescription: null, seoKeywords: null, canonicalUrl: null, createdAt: new Date(0), updatedAt: new Date(0) };
    }
    const posts = tag ? await db.select().from(blogPosts).where(and(
      eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()),
      sql`jsonb_exists(${blogPosts.tags}, ${tag.name})`,
    )).orderBy(desc(blogPosts.publishedAt)) : [];
    return { tag, posts };
  }, ["public-blog-tag-archive-v1", slug], { tags: [PUBLIC_BLOG_TAG], revalidate: 300 })();
  const tag = archive.tag ? { ...archive.tag, createdAt: new Date(String(archive.tag.createdAt)), updatedAt: new Date(String(archive.tag.updatedAt)) } : undefined;
  return { tag, posts: archive.posts.map(revivePostDates) };
}
