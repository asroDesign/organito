import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, stories } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { StoryManager } from "@/components/StoryManager";
import { Film } from "lucide-react";

export default async function AdminStoriesPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const [records, productRows] = await Promise.all([
    db.select({ story: stories, productName: products.nameFa }).from(stories).leftJoin(products, eq(products.id, stories.productId)).orderBy(desc(stories.updatedAt)).limit(200),
    db.select({ id: products.id, nameFa: products.nameFa, brand: products.brand, slug: products.slug, mainImageId: products.mainImageId }).from(products).where(inArray(products.status, ["active", "out_of_stock"])).orderBy(products.nameFa).limit(1000),
  ]);
  const initial = records.map(({ story, productName }) => ({ ...story, mediaType: story.mediaType as "image" | "video", startsAt: story.startsAt?.toISOString() ?? null, endsAt: story.endsAt?.toISOString() ?? null, productName }));
  return <><PageHeader title="استوری‌های فروشگاه" subtitle="انتشار و زمان‌بندی استوری‌های تصویری و ویدیویی"/><FeatureIntro className="mb-5" icon={Film} title="مدیریت استوری" text="استوری‌های منتشرشده در صفحهٔ اصلی نمایش داده می‌شوند. آمار بازدید یکتا و پسندها بدون ذخیرهٔ IP نگهداری می‌شود؛ بایگانی، سابقه و آمار را حفظ می‌کند."/><StoryManager initial={initial} products={productRows}/></>;
}
