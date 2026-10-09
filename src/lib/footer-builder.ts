export type FooterItemType = "text" | "link" | "image" | "html" | "brand" | "contact" | "divider";
export type FooterBlock = { id: string; type: FooterItemType; enabled: boolean; title: string; content: string; href: string; src: string; alt: string; width: number; height: number; newTab: boolean };
export type FooterColumn = { id: string; title: string; align: "right" | "center" | "left"; layout: "stack" | "row"; items: FooterBlock[] };
export type FooterSection = { id: string; title: string; enabled: boolean; border: boolean; columns: FooterColumn[] };
export type FooterConfig = { version: 1; enabled: boolean; theme: "light" | "dark" | "system"; copyright: string; sections: FooterSection[] };
export type FooterBrandData = { siteName: string; siteTagline: string; siteLogoMediaId: number; supportPhone: string; supportEmail: string; supportHours: string; senderAddress: string };
export const footerTypeLabels: Record<FooterItemType, string> = { text: "متن", link: "پیوند / شبکه اجتماعی", image: "تصویر و بنر لینک‌دار", html: "کد HTML / نشان", brand: "نام و لوگوی فروشگاه", contact: "اطلاعات تماس فروشگاه", divider: "جداکننده" };
export const footerUrlAllowed = (value: string, image = false) => !value || (!/[\s\\\u0000-\u001f]/.test(value) && ((value.startsWith("/") && !value.startsWith("//")) || /^https:\/\//i.test(value) || (!image && /^(mailto:|tel:|#)/i.test(value))));
export const footerText = (value: string, brand: FooterBrandData) => value.replace(/\{\{(siteName|siteTagline|supportPhone|supportEmail|supportHours|senderAddress)\}\}/g, (_, key: keyof FooterBrandData) => String(brand[key]));
