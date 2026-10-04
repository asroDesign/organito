import Link from "next/link";
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, categories, products } from "@/db/schema";
import { sanitizeRich, toSafeHtml } from "@/lib/html";
import { toman } from "@/lib/util";
import { Img } from "./ui";

type Attrs = Record<string, string>;
const attr = (raw: string): Attrs => Object.fromEntries([...raw.matchAll(/([a-z-]+)\s*=\s*"([^"]*)"/gi)].map(m => [m[1].toLowerCase(), m[2].slice(0, 180)]));
const safeLimit = (value?: string) => Math.max(1, Math.min(12, Number.parseInt(value ?? "6", 10) || 6));

function VideoBlock({ url, title }: { url: string; title: string }) {
  if (/^\/api\/media\/\d+$/.test(url)) return <figure className="my-8 overflow-hidden rounded-2xl bg-black"><video className="aspect-video w-full" controls preload="metadata" src={url}/><figcaption className="bg-slate-50 p-3 text-center text-sm">{title}</figcaption></figure>;
  let embed = "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const youtubeHost = ["youtu.be", "www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(u.hostname);
    const youtube = !youtubeHost ? null : u.hostname === "youtu.be" ? u.pathname.slice(1) : u.pathname.match(/\/embed\/([\w-]+)/)?.[1] ?? u.searchParams.get("v");
    if (youtube && /^[\w-]{6,20}$/.test(youtube)) embed = `https://www.youtube-nocookie.com/embed/${youtube}`;
    else if (["aparat.com", "www.aparat.com"].includes(u.hostname)) {
      const id = u.pathname.match(/(?:v\/|video\/)([\w-]+)/)?.[1];
      if (id && /^[\w-]+$/.test(id)) embed = `https://www.aparat.com/video/video/embed/videohash/${id}/vt/frame`;
    } else if (["vimeo.com", "www.vimeo.com"].includes(u.hostname)) {
      const id = u.pathname.match(/^\/(\d+)/)?.[1];
      if (id) embed = `https://player.vimeo.com/video/${id}`;
    }
  } catch { return null; }
  return embed ? <figure className="my-8 overflow-hidden rounded-2xl bg-black"><iframe className="aspect-video w-full" src={embed} title={title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/><figcaption className="bg-slate-50 p-3 text-center text-sm">{title}</figcaption></figure> : null;
}

async function Shortcode({ code, rawAttrs }: { code: string; rawAttrs: string }) {
  const a = attr(rawAttrs);
  if (code === "video") return <VideoBlock url={(a.url ?? "").trim()} title={a.title || "ویدیو"}/>;
  const limit = safeLimit(a.limit);
  if (code === "products") {
    let categoryId: number | undefined;
    const requested = (a.category ?? "").trim();
    if (requested) {
      const [category] = await db.select({ id: categories.id }).from(categories).where(/^[0-9]+$/.test(requested) ? eq(categories.id, Number(requested)) : eq(categories.slug, requested)).limit(1);
      if (!category) return <p className="my-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">دسته‌بندی محصولات این بلوک پیدا نشد.</p>;
      categoryId = category.id;
    }
    const rows = await db.select({ id: products.id, name: products.nameFa, slug: products.slug, price: products.basePrice, imageId: products.mainImageId }).from(products).where(and(eq(products.status, "active"), categoryId ? eq(products.categoryId, categoryId) : undefined)).orderBy(desc(products.updatedAt)).limit(limit);
    if (!rows.length) return null;
    return <section className="my-8"><h3 className="mb-4 text-xl font-black text-emerald-950">محصولات پیشنهادی</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{rows.map(p => <Link key={p.id} href={`/products/${p.slug}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">{p.imageId ? <Img id={p.imageId} alt={p.name} className="aspect-square w-full"/> : <div className="aspect-square bg-emerald-50"/>}<div className="p-3"><b className="line-clamp-2 text-sm text-slate-800">{p.name}</b><span className="mt-2 block text-sm font-bold text-emerald-800">{toman(p.price)}</span></div></Link>)}</div></section>;
  }
  const filter = (a.category ?? "").trim();
  const posts = await db.select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt, imageId: blogPosts.coverImageId, category: blogPosts.category }).from(blogPosts).where(and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()), filter ? eq(blogPosts.category, filter) : undefined)).orderBy(desc(blogPosts.publishedAt)).limit(limit);
  if (!posts.length) return null;
  return <section className="my-8"><h3 className="mb-4 text-xl font-black text-emerald-950">مطالب مرتبط</h3><div className="flex snap-x gap-4 overflow-x-auto pb-3">{posts.map(p => <Link key={p.id} href={`/blog/${p.slug}`} className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white hover:shadow-md">{p.imageId ? <Img id={p.imageId} alt={p.title} className="aspect-[16/9] w-full"/> : <div className="aspect-[16/9] bg-amber-50"/>}<div className="p-4"><small className="text-emerald-700">{p.category}</small><b className="mt-1 block line-clamp-2 text-sm">{p.title}</b>{p.excerpt&&<p className="mt-2 line-clamp-2 text-xs text-slate-500">{p.excerpt}</p>}</div></Link>)}</div></section>;
}

/** Render sanitized rich HTML interleaved with allow-listed, server-rendered content blocks. */
export async function RichContent({ content }: { content: string | null | undefined }) {
  const source = toSafeHtml(content);
  const token = /\{\{(products|blog-carousel|video)\s+([^{}]*)\}\}/g;
  const chunks: { html?: string; code?: string; attrs?: string }[] = [];
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > cursor) chunks.push({ html: source.slice(cursor, index) });
    chunks.push({ code: match[1], attrs: match[2] });
    cursor = index + match[0].length;
  }
  if (!chunks.length) return <div dangerouslySetInnerHTML={{ __html: sanitizeRich(source) }}/>;
  if (cursor < source.length) chunks.push({ html: source.slice(cursor) });
  return <>{await Promise.all(chunks.map(async (chunk, i) => chunk.code
    ? <Shortcode key={`block-${i}`} code={chunk.code} rawAttrs={chunk.attrs ?? ""}/>
    : <div key={`html-${i}`} dangerouslySetInnerHTML={{ __html: sanitizeRich(chunk.html ?? "") }}/>))}</>;
}
