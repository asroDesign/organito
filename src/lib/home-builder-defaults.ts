import type { SitePageBlock, SitePageBlockItem } from "@/db/schema";
import type { SettingsShape } from "./settings";
import { identifyBlocks } from "./page-builder";
export function homeBuilderDefaults(blocks: SitePageBlock[], st: Pick<SettingsShape, "siteName" | "heroTitle" | "heroSubtitle" | "returnDays" | "currency" | "multiVendor" | "allowSellerSignup">): SitePageBlock[] {
  const text: Record<string, [string, string, string?, string?]> = {
    hero: [st.heroTitle, st.heroSubtitle, "شروع خرید", "/shop"], trust: ["", ""], categories: ["دسته‌بندی محصولات", "از کندو و باغ تا مزرعه"],
    popular: [`محبوب‌ترین‌های ${st.siteName}`, "انتخاب مشتریان در هفته گذشته"], fresh: ["تازه رسیده‌ها", "محصولات فصل و جدیدترین‌ها"], deals: ["شگفت‌انگیزهای امروز", ""],
    why: ["سلامت شما، سلامت زمین", `محصولات ارگانیک بدون سموم شیمیایی، کود مصنوعی و مواد نگهدارنده تولید می‌شوند. هر محصول در ${st.siteName} پیش از عرضه از نظر اصالت، بقایای سموم و کیفیت بررسی می‌شود.`, "بیشتر بدانید", "/about"],
    guarantee: [`ضمانت بازگشت ${st.returnDays.toLocaleString("fa-IR")} روزه با تست آزمایشگاه`, "اگر آزمایشگاه اصل نبودن محصول را تأیید کند، یا عطر و طعم آن به هر دلیلی مورد پسند شما نباشد، محصول را پس می‌گیریم و مبلغ را کامل برمی‌گردانیم.", "شرایط بازگشت", "/faq"],
    farms: ["تولیدکنندگان منتخب", "با کشاورزان و تولیدکنندگان ما آشنا شوید"], blog: [`از مجله ${st.siteName}`, "راهنمای انتخاب آگاهانه و زندگی سالم"], testimonials: ["مشتریان درباره ما", `تجربه واقعی خرید از ${st.siteName}`],
  };
  const pairs = (a: string[][]): SitePageBlockItem[] => a.map(([title, body]) => ({ title, body }));
  const items: Record<string, SitePageBlockItem[]> = {
    trust: pairs([["گواهی ارگانیک معتبر", "بازرسی و آزمون آزمایشگاهی"], ["ارسال تازه و سریع", "بسته‌بندی عایق و بهداشتی"], ["پرداخت امن امانی", "آزادسازی وجه پس از تحویل"], ["حمایت از کشاورز", "خرید مستقیم و منصفانه"]]),
    why: pairs([["ارزش غذایی بالاتر", "ویتامین و آنتی‌اکسیدان بیشتر"], ["آزمون آزمایشگاهی", "بدون باقی‌مانده سموم"], ["کشاورزی پایدار", "حفظ خاک و منابع آب"], ["بدون افزودنی", "طعم و عطر طبیعی"]]),
    testimonials: pairs([["مریم احمدی", "عسل آویشن واقعاً طبیعی بود؛ بسته‌بندی عالی و ارسال سریع. دیگه از هیچ جای دیگه خرید نمی‌کنم."], ["علی رضایی", "سبد سبزیجات هفتگی تازه و خوش‌طعمه. خوبیش اینه که مستقیم از کشاورز میاد."], ["سارا کریمی", "روغن زیتون فرابکر با گواهی معتبر و قیمت منصفانه. پشتیبانی هم خیلی پاسخگو بود."]]),
    promo: [{ title: "اولین خرید با WELCOME10", body: `۱۰٪ تخفیف برای خرید بالای ۵۰۰ هزار ${st.currency}`, buttonLabel: "شروع خرید", href: "/shop" }, st.multiVendor && st.allowSellerSignup ? { title: "کشاورز یا تولیدکننده هستید؟", body: "محصولاتتان را بدون واسطه به هزاران خانواده بفروشید.", buttonLabel: "ثبت‌نام تولیدکنندگان", href: "/login?seller=1" } : { title: "محصول خاصی می‌خواهید؟", body: "سفارش ویژه ثبت کنید تا برایتان تهیه کنیم.", buttonLabel: "ثبت سفارش ویژه", href: "/customer/supply" }],
  };
  return identifyBlocks(blocks.map(b => {
    if (b.type !== "store_section") return b;
    const d = text[b.sectionId || ""];
    return { ...b, title: b.title || d?.[0] || "", body: b.body || d?.[1] || "", buttonLabel: b.buttonLabel || d?.[2] || "", href: b.href || d?.[3] || "", items: b.items?.length ? b.items : items[b.sectionId || ""] || [], options: b.sectionId === "hero" ? { badge: "مستقیم از مزرعه به سفره شما", secondaryLabel: "پیشنهادهای ویژه", secondaryHref: "/shop?fest=1", ...b.options } : b.options };
  }));
}
