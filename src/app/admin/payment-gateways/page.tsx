import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { PaymentGatewaySettings } from "@/components/PaymentGatewaySettings";

export default async function PaymentGatewaysPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  return <><PageHeader title="درگاه‌های پرداخت" subtitle="اتصال، آیکن و فعال‌سازی هم‌زمان درگاه‌ها" /><PaymentGatewaySettings initial={{
    paymentGatewaysConfigured: s.paymentGatewaysConfigured,
    paymentManualEnabled: s.paymentManualEnabled,
    paymentZarinpalEnabled: s.paymentZarinpalEnabled, paymentZibalEnabled: s.paymentZibalEnabled, paymentTorobpayEnabled: s.paymentTorobpayEnabled,
    paymentZarinpalIconId: s.paymentZarinpalIconId, paymentZibalIconId: s.paymentZibalIconId, paymentTorobpayIconId: s.paymentTorobpayIconId,
    zarinpalMerchantId: s.zarinpalMerchantId, zarinpalSandbox: s.zarinpalSandbox, zibalMerchant: s.zibalMerchant,
    torobpayClientId: s.torobpayClientId, torobpayClientSecret: "", torobpayClientSecretConfigured: s.torobpayClientSecret.length > 0 ? 1 : 0,
    torobpayUsername: s.torobpayUsername, torobpayPassword: "", torobpayPasswordConfigured: s.torobpayPassword.length > 0 ? 1 : 0,
  }} /></>;
}
