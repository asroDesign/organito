import Link from "next/link";
import { desc } from "drizzle-orm";
import { FileText, Plus, Search, Tags } from "lucide-react";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { requirePage } from "@/lib/auth";
import { jdate } from "@/lib/util";
import { ActionButton } from "@/components/client";
import { Badge, FeatureIntro, PageHeader, PanelTabs, Table, Td } from "@/components/ui";

export default async function AdminBlogPage() {
  const user = await requirePage({ perm: "PRODUCTS_EDIT" });
  const [posts, settings] = await Promise.all([db.select().from(blogPosts).orderBy(desc(blogPosts.updatedAt)), getSettings()]);
  return <>
    <PageHeader title="وبلاگ و سئو" subtitle="مدیریت مجله تخصصی و تنظیمات دیده‌شدن صفحات در موتورهای جست‌وجو" />
    <PanelTabs items={[{ href: "/admin/blog", label: "مقالات", active: true, icon: FileText }, { href: "/admin/blog/taxonomy", label: "دسته‌ها و برچسب‌ها", icon: Tags }, ...(user.permissions.includes("SETTINGS_MANAGE") ? [{ href: "/admin/blog/seo", label: "تنظیمات سئوی صفحات", icon: Search }] : [])]} />
    <FeatureIntro className="mt-5" icon={FileText} title="مجله محتوایی {settings.siteName}" text="مقالات راهنما با محتوای غنی، تصویر شاخص، پیش‌نویس، متادیتای مستقل و داده ساختاریافته منتشر می‌شوند." action={<Link href="/admin/blog/new" className="btn-primary"><Plus className="h-4 w-4" />نوشته جدید</Link>} />
    <div className="mt-5"><Table head={["عنوان", "دسته", "وضعیت", "آخرین تغییر", "مدیریت"]} empty={!posts.length}>{posts.map((p) => <tr key={p.id} className="hover:bg-slate-50"><Td><b>{p.title}</b><small className="mt-1 block text-slate-400" dir="ltr">/blog/{p.slug}</small></Td><Td>{p.category}</Td><Td><Badge tone={p.status === "published" ? "green" : "gray"}>{p.status === "published" ? "منتشرشده" : "پیش‌نویس"}</Badge></Td><Td>{jdate(p.updatedAt, true)}</Td><Td><div className="flex gap-1"><Link href={`/admin/blog/${p.id}/edit`} className="btn-sm">ویرایش</Link>{p.status === "published" && <Link href={`/blog/${p.slug}`} className="btn-sm" target="_blank">نمایش</Link>}<ActionButton url={`/api/admin/blog/${p.id}`} data={{ delete: true }} confirm={`نوشته «${p.title}» حذف شود؟`} success="نوشته حذف شد" className="btn-sm text-rose-600">حذف</ActionButton></div></Td></tr>)}</Table></div>
  </>;
}
