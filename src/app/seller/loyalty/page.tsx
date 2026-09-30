import { PageHeader } from "@/components/ui";
import SellerLoyaltyClient from "@/components/SellerLoyaltyClient";

export default function SellerLoyaltyPage() {
  return <><PageHeader title="باشگاه مشتریان" subtitle="فهرست مشتریان حضوری، سابقه خرید و پیامک با پنل اختصاصی فروشگاه شما"/><SellerLoyaltyClient/></>;
}
