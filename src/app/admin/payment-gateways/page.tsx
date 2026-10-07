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
    paymentZarinpalEnabled: s.paymentZarinpalEnabled, paymentZibalEnabled: s.paymentZibalEnabled, paymentTorobpayEnabled: s.paymentTorobpayEnabled, paymentNextpayEnabled: s.paymentNextpayEnabled, paymentDigipayEnabled: s.paymentDigipayEnabled, paymentSnappayEnabled: s.paymentSnappayEnabled, paymentBehpardakhtEnabled: s.paymentBehpardakhtEnabled, paymentPasargadEnabled:s.paymentPasargadEnabled, paymentVandarEnabled:s.paymentVandarEnabled,
    paymentZarinpalIconId: s.paymentZarinpalIconId, paymentZibalIconId: s.paymentZibalIconId, paymentTorobpayIconId: s.paymentTorobpayIconId, paymentNextpayIconId: s.paymentNextpayIconId, paymentDigipayIconId: s.paymentDigipayIconId, paymentSnappayIconId: s.paymentSnappayIconId, paymentBehpardakhtIconId: s.paymentBehpardakhtIconId, paymentPasargadIconId:s.paymentPasargadIconId, paymentVandarIconId:s.paymentVandarIconId,
    zarinpalMerchantId: s.zarinpalMerchantId, zarinpalSandbox: s.zarinpalSandbox, zibalMerchant: s.zibalMerchant,
    torobpayClientId: s.torobpayClientId, torobpayClientSecret: "", torobpayClientSecretConfigured: s.torobpayClientSecret.length > 0 ? 1 : 0,
    torobpayUsername: s.torobpayUsername, torobpayPassword: "", torobpayPasswordConfigured: s.torobpayPassword.length > 0 ? 1 : 0,
    nextpayApiKey: "", nextpayApiKeyConfigured: s.nextpayApiKey.length > 0 ? 1 : 0,
    digipayClientId: s.digipayClientId, digipayClientSecret: "", digipayClientSecretConfigured: s.digipayClientSecret.length > 0 ? 1 : 0,
    digipayUsername: s.digipayUsername, digipayPassword: "", digipayPasswordConfigured: s.digipayPassword.length > 0 ? 1 : 0,
    digipaySandbox: s.digipaySandbox, digipayAmountMultiplier: s.digipayAmountMultiplier, digipayPreferredGateway: s.digipayPreferredGateway,
    snappayApiBaseUrl: s.snappayApiBaseUrl, snappayClientId: s.snappayClientId, snappayClientSecret: "", snappayClientSecretConfigured: s.snappayClientSecret.length > 0 ? 1 : 0, snappayUsername: s.snappayUsername, snappayPassword: "", snappayPasswordConfigured: s.snappayPassword.length > 0 ? 1 : 0,
    behpardakhtTerminalId: s.behpardakhtTerminalId, behpardakhtUsername: s.behpardakhtUsername, behpardakhtPassword: "", behpardakhtPasswordConfigured: s.behpardakhtPassword.length > 0 ? 1 : 0,
    pasargadTerminalId:s.pasargadTerminalId, pasargadUsername:s.pasargadUsername, pasargadPassword:"", pasargadPasswordConfigured:s.pasargadPassword.length>0?1:0, vandarApiKey:"", vandarApiKeyConfigured:s.vandarApiKey.length>0?1:0,
  }} /></>;
}
