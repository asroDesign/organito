import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { FileText, Plus, Search, Tags } from "lucide-react";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { requirePage } from "@/lib/auth";
import { jdate } from "@/lib/util";
import { ActionButton } from "@/components/client";
import { Badge, FeatureIntro, PageHeader, PanelTabs, Table, Td } from "@/components/ui";
import { BlogReviewActions } from "@/components/BlogReviewActions";

export default async function AdminBlogPage() {
  const user = await requirePage({ anyPerm: ["PRODUCTS_EDIT", "BLOG_PUBLISH"] });
  const canEdit = user.permissions.includes("PRODUCTS_EDIT"), canReview = user.permissions.includes("BLOG_PUBLISH");
  const [posts, settings] = await Promise.all([db.select().from(blogPosts).where(and(isNull(blogPosts.deletedAt), canReview ? undefined : eq(blogPosts.authorId, user.id))).orderBy(desc(blogPosts.updatedAt)), getSettings()]);
  return <>
    <PageHeader title="وبلاگ و سئو" subtitle="مدیریت مجله تخصصی و تنظیمات دیده‌شدن صفحات در موتورهای جست‌وجو" />
    <PanelTabs items={[{ href: "/admin/blog", label: canReview ? "مقالات و بازبینی" : "مقاله‌های من", active: true, icon: FileText }, ...(canEdit ? [{ href: "/admin/blog/taxonomy", label: "دسته‌ها و برچسب‌ها", icon: Tags }] : []), ...(user.permissions.includes("SETTINGS_MANAGE") ? [{ href: "/admin/blog/seo", label: "تنظیمات سئوی صفحات", icon: Search }] : [])]} />
    <FeatureIntro className="mt-5" icon={FileText} title={`مجله محتوایی ${settings.siteName}`} text="مقاله‌ها می‌توانند متنی، ویدئویی یا صوتی باشند. نویسنده‌ها مقاله را برای بازبینی می‌فرستند و انتشار از صف تأیید انجام می‌شود." action={canEdit ? <Link href="/admin/blog/new" className="btn-primary"><Plus className="h-4 w-4" />نوشته جدید</Link> : undefined} />
    <div className="mt-5"><Table head={["عنوان", "دسته", "وضعیت", "آخرین تغییر", "مدیریت"]} empty={!posts.length}>{posts.map((p) => <tr key={p.id} className="hover:bg-slate-50"><Td><b>{p.title}</b><small className="mt-1 block text-slate-400" dir="ltr">/blog/{p.slug}</small>{p.reviewNote && <small className="mt-1 block text-amber-700">یادداشت بازبینی: {p.reviewNote}</small>}</Td><Td>{p.category}<small className="mt-1 block text-slate-400">{p.contentType === "video" ? "ویدئویی" : p.contentType === "audio" ? "صوتی" : "متنی"}</small></Td><Td><Badge tone={p.status === "published" ? "green" : p.status === "in_review" ? "yellow" : "gray"}>{p.status === "published" ? "منتشرشده" : p.status === "in_review" ? "در انتظار بازبینی" : "پیش‌نویس"}</Badge></Td><Td>{jdate(p.updatedAt, true)}</Td><Td><div className="flex flex-col gap-2">{canEdit && (canReview || p.authorId === user.id) && <div className="flex flex-wrap gap-1"><Link href={`/admin/blog/${p.id}/edit`} className="btn-sm">ویرایش</Link>{p.status === "published" && <Link href={`/blog/${p.slug}`} className="btn-sm" target="_blank">نمایش</Link>}<ActionButton url={`/api/admin/blog/${p.id}`} data={{ delete: true }} confirm={`نوشته «${p.title}» به زباله منتقل شود؟`} success="نوشته به زباله منتقل شد" className="btn-sm text-rose-600">انتقال به زباله</ActionButton></div>}{canReview && p.status === "in_review" && <BlogReviewActions postId={p.id}/>}</div></Td></tr>)}</Table></div>
  </>;
}
