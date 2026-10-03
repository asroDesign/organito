import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Leaf } from "lucide-react";
import { Img } from "./ui";
import { jdate } from "@/lib/util";
import { stripHtml } from "@/lib/html";
import { siteBrandText } from "@/lib/brand";

export type BlogCardPost = { id: number; title: string; slug: string; excerpt: string | null; content: string; coverImageId: number | null; category: string; publishedAt: Date | string | null };

export function BlogCard({ post, featured = false, siteName = "فروشگاه ارگانیک" }: { post: BlogCardPost; featured?: boolean; siteName?: string }) {
  const title = siteBrandText(post.title, siteName), excerpt = siteBrandText(post.excerpt, siteName), content = siteBrandText(post.content, siteName), category = siteBrandText(post.category, siteName);
  const minutes = Math.max(1, Math.ceil(stripHtml(content, 100000).split(/\s+/).length / 220));
  return <article className={`group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl ${featured ? "md:grid md:grid-cols-2" : ""}`}>
    <Link href={`/blog/${post.slug}`} className={`block overflow-hidden bg-emerald-50 ${featured ? "min-h-72" : "h-52"}`}>{post.coverImageId ? <Img id={post.coverImageId} alt={title} className="h-full w-full transition duration-500 group-hover:scale-105" /> : <span className="grid h-full min-h-52 place-items-center bg-gradient-to-br from-lime-100 via-emerald-100 to-teal-200 text-emerald-700"><Leaf className="h-16 w-16 transition duration-500 group-hover:scale-110 group-hover:rotate-6" /></span>}</Link>
    <div className="flex flex-col p-5"><span className="mb-3 w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{category}</span><h2 className={`${featured ? "text-2xl" : "text-lg"} font-black leading-8 text-emerald-950`}><Link href={`/blog/${post.slug}`}>{title}</Link></h2><p className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{excerpt || stripHtml(content, 180)}</p><div className="mt-auto flex items-center gap-4 pt-5 text-xs text-slate-400"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{jdate(post.publishedAt)}</span><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{minutes.toLocaleString("fa-IR")} دقیقه</span><ArrowLeft className="mr-auto h-4 w-4 text-emerald-600" /></div></div>
  </article>;
}
