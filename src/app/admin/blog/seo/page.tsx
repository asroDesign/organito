import { FileText, Search, Tags } from "lucide-react";
import { JsonForm } from "@/components/client";
import { Card, FeatureIntro, PageHeader, PanelTabs } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export default async function SeoSettingsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  return <>
    <PageHeader title="تنظیمات سئوی صفحات" subtitle="عنوان، توضیحات و نشانی پایه برای صفحه اصلی، فروشگاه و وبلاگ" />
    <PanelTabs items={[{ href: "/admin/blog", label: "مقالات", icon: FileText }, { href: "/admin/blog/taxonomy", label: "دسته‌ها و برچسب‌ها", icon: Tags }, { href: "/admin/blog/seo", label: "تنظیمات سئوی صفحات", active: true, icon: Search }]} />
    <FeatureIntro className="mt-5" icon={Search} title="سئوی فنی و محتوایی" text="این مقادیر در title، description، canonical، Open Graph، sitemap و داده‌های ساختاریافته استفاده می‌شوند." />
    <Card className="mt-5" title="تنظیمات عمومی و صفحات اصلی"><JsonForm url="/api/admin/settings" submit="ذخیره تنظیمات سئو" resetOnDone={false} fields={[
      { name: "siteUrl", label: "آدرس کامل سایت", placeholder: "https://example.com", defaultValue: s.siteUrl },
      { name: "defaultOgImageId", label: "شناسه تصویر پیش‌فرض اشتراک‌گذاری", type: "number", half: true, defaultValue: s.defaultOgImageId },
      { name: "homeSeoTitle", label: "عنوان سئو صفحه اصلی", defaultValue: s.homeSeoTitle },
      { name: "homeSeoDescription", label: "توضیحات متا صفحه اصلی", type: "textarea", defaultValue: s.homeSeoDescription },
      { name: "homeSeoKeywords", label: "کلمات کلیدی صفحه اصلی", defaultValue: s.homeSeoKeywords },
      { name: "shopSeoTitle", label: "عنوان سئو فروشگاه", defaultValue: s.shopSeoTitle },
      { name: "shopSeoDescription", label: "توضیحات متا فروشگاه", type: "textarea", defaultValue: s.shopSeoDescription },
      { name: "shopSeoKeywords", label: "کلمات کلیدی فروشگاه", defaultValue: s.shopSeoKeywords },
      { name: "blogSeoTitle", label: "عنوان سئو صفحه اصلی وبلاگ", defaultValue: s.blogSeoTitle },
      { name: "blogSeoDescription", label: "توضیحات متا صفحه اصلی وبلاگ", type: "textarea", defaultValue: s.blogSeoDescription },
      { name: "blogSeoKeywords", label: "کلمات کلیدی وبلاگ", defaultValue: s.blogSeoKeywords },
    ]} /></Card>
    <Card className="mt-5" title="دسترسی ربات‌های جست‌وجو (robots.txt)">
      <p className="mb-4 text-sm leading-7 text-slate-600">این تنظیمات خروجی <code dir="ltr">/robots.txt</code> را کنترل می‌کنند. هر ربات یا مسیر را در یک خط بنویسید؛ مسیرها باید نسبی و با / شروع شوند. نشانی sitemap به‌صورت خودکار از دامنهٔ سایت ساخته می‌شود.</p>
      <JsonForm url="/api/admin/settings" submit="ذخیره تنظیمات robots" resetOnDone={false} fields={[
        { name: "robotsUserAgents", label: "نام ربات‌ها (هر خط یک مورد؛ برای همه از * استفاده کنید)", type: "textarea", defaultValue: s.robotsUserAgents },
        { name: "robotsAllowPaths", label: "مسیرهای مجاز (هر خط یک مسیر)", type: "textarea", defaultValue: s.robotsAllowPaths },
        { name: "robotsDisallowPaths", label: "مسیرهای غیرمجاز (هر خط یک مسیر)", type: "textarea", defaultValue: s.robotsDisallowPaths },
        { name: "robotsSitemapEnabled", label: "نمایش آدرس sitemap.xml در robots.txt", type: "checkbox", defaultValue: Number(s.robotsSitemapEnabled) !== 0 },
      ]} />
    </Card>
  </>;
}
