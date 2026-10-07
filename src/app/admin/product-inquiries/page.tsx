import { requirePage } from "@/lib/auth";
import { getProductInquiryData } from "@/lib/product-inquiry-data";
import { PageHeader, FeatureIntro } from "@/components/ui";
import { ProductInquiryManager } from "@/components/ProductInquiryManager";
import { PhoneCall } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function ProductInquiriesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string }> }) {
  await requirePage({ perm: "PRODUCTS_VIEW" });
  const data = await getProductInquiryData(await searchParams);
  return <><PageHeader title="استعلام قیمت و موجودی" subtitle={`${data.total.toLocaleString("fa-IR")} درخواست مشتری`} /><FeatureIntro className="mb-5" icon={PhoneCall} title="پیگیری درخواست‌های تلفنی" text="درخواست مشتریان در این فهرست ثبت می‌شود. درخواست را به اپراتور بسپارید، نتیجه تماس را یادداشت کنید و در صورت خرید، سفارش مرتبط را ثبت کنید."/><ProductInquiryManager {...data}/></>;
}
