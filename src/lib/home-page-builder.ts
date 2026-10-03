import type { SitePageBlock } from "@/db/schema";

export const HOME_SECTION_LABELS: Record<string, string> = {
  hero: "بنر اصلی و جست‌وجو",
  trust: "مزیت‌ها و اعتمادسازی",
  categories: "دسته‌بندی محصولات",
  festival: "جشنواره فعال",
  deals: "پیشنهادهای روز",
  popular: "محبوب‌ترین محصولات",
  why: "چرا خرید ارگانیک",
  guarantee: "ضمانت بازگشت",
  farms: "تولیدکنندگان منتخب",
  fresh: "تازه‌رسیده‌ها",
  blog: "مجله و مقاله‌ها",
  testimonials: "نظر مشتریان",
  promo: "بنرهای پایانی و فراخوان",
};

export const DEFAULT_HOME_LAYOUT: SitePageBlock[] = Object.entries(HOME_SECTION_LABELS).map(([sectionId]) => ({
  type: "store_section",
  sectionId,
  title: "",
  body: "",
  items: [],
}));

export function createHomeTemplateBlocks(layout: SitePageBlock[]): SitePageBlock[] {
  const features = (title: string, body: string, items: SitePageBlock["items"]): SitePageBlock => ({ type: "features", title, body, items: items?.length ? items : [
    { title: "کیفیت قابل اعتماد", body: "محصولات با دقت انتخاب و بررسی می‌شوند." },
    { title: "ارسال سریع", body: "سفارش‌ها با بسته‌بندی مناسب به دست شما می‌رسند." },
  ] });
  const grid = (title: string, body: string, items: SitePageBlock["items"]): SitePageBlock => ({ type: "grid", title, body, items: items?.length ? items : [
    { kind: "cta", title: "مشاهده محصولات", body: "محصول دلخواهتان را از فروشگاه انتخاب کنید.", buttonLabel: "رفتن به فروشگاه", href: "/shop" },
    { kind: "cta", title: "راهنمای خرید", body: "با محصولات و شیوه انتخاب آن‌ها آشنا شوید.", buttonLabel: "مطالعه راهنما", href: "/blog" },
  ] });
  return layout.flatMap((block) => {
    if (block.type !== "store_section") return [{ ...block, items: block.items?.map((item) => ({ ...item })) }];
    const title = block.title || HOME_SECTION_LABELS[block.sectionId ?? ""] || "بخش فروشگاه";
    const body = block.body || "این بخش را متناسب با محتوای صفحه ویرایش کنید.";
    switch (block.sectionId) {
      case "hero": return [{ type: "hero", title: block.title || "محصولات ارگانیک، مستقیم از تولیدکننده", body: block.body || "کیفیت طبیعی و تازه را برای خانه خود انتخاب کنید.", mediaId: block.mediaId ?? null }];
      case "trust": return [features(block.title || "تجربه خرید مطمئن", block.body || "کیفیت، تازگی و همراهی با تولیدکنندگان محلی.", block.items)];
      case "categories": return [grid(block.title || "دسته‌بندی محصولات", block.body || "محصولات مورد نیازتان را آسان‌تر پیدا کنید.", block.items)];
      case "festival": return [{ type: "cta", title, body: block.body || "پیشنهادهای ویژه و تخفیف‌های جاری را ببینید.", buttonLabel: "مشاهده جشنواره", href: "/shop?fest=1" }];
      case "deals": return [grid(block.title || "پیشنهادهای ویژه", block.body || "فرصت خرید محصولات منتخب با قیمت مناسب.", block.items)];
      case "popular": return [grid(block.title || "محبوب‌ترین محصولات", block.body || "انتخاب‌های پرطرفدار مشتریان.", block.items)];
      case "why": return [{ type: "text", title: block.title || "چرا محصولات ارگانیک؟", body: block.body || "انتخاب محصولات طبیعی به سلامت خانواده و پایداری کشاورزی کمک می‌کند." }];
      case "guarantee": return [{ type: "cta", title: block.title || "خرید با اطمینان", body: block.body || "برای آشنایی با شرایط پشتیبانی و بازگشت کالا، راهنمای ما را ببینید.", buttonLabel: "شرایط و راهنما", href: "/faq" }];
      case "farms": return [features(block.title || "تولیدکنندگان منتخب", block.body || "با تولیدکنندگان و شیوه تولید محصولات آشنا شوید.", block.items)];
      case "fresh": return [grid(block.title || "تازه‌رسیده‌ها", block.body || "محصولات تازه و جدید فروشگاه را ببینید.", block.items)];
      case "blog": return [grid(block.title || "مجله و راهنمای خرید", block.body || "مقاله‌ها و نکته‌های کاربردی برای انتخاب آگاهانه.", block.items?.length ? block.items : [{ kind: "cta", title: "مطالب مجله", body: "مقاله‌های آموزشی و تازه را بخوانید.", buttonLabel: "ورود به مجله", href: "/blog" }])];
      case "testimonials": return [features(block.title || "دیدگاه مشتریان", block.body || "تجربه خریداران را درباره محصولات بخوانید.", block.items)];
      case "promo": return [{ type: "cta", title: block.title || "از فروشگاه دیدن کنید", body: block.body || "محصول مورد نظرتان را پیدا و سفارش خود را ثبت کنید.", buttonLabel: "شروع خرید", href: "/shop" }];
      default: return [];
    }
  });
}
