import type { SettingsShape } from "./settings";

export type GatewayId = "zarinpal" | "zibal" | "torobpay" | "nextpay" | "digipay" | "snappay" | "behpardakht" | "pasargad" | "vandar";
export type PaymentGatewayOption = { id: GatewayId; label: string; iconId: number };

const LEGACY_LABELS: Record<GatewayId, string> = { zarinpal: "زرین‌پال", zibal: "زیبال", torobpay: "ترب‌پی", nextpay: "نکست‌پی", digipay: "دیجی‌پی", snappay: "اسنپ‌پی", behpardakht: "به‌پرداخت ملت", pasargad: "پاسارگاد", vandar: "وندار" };

export function getPaymentGatewayOptions(settings: SettingsShape): PaymentGatewayOption[] {
  if (Number(settings.paymentGatewaysConfigured) !== 1) {
    const id = settings.paymentGateway === "zibal" ? "zibal" : "zarinpal";
    return [{ id, label: LEGACY_LABELS[id], iconId: 0 }];
  }
  const all: [GatewayId, number, number][] = [
    ["zarinpal", settings.paymentZarinpalEnabled, settings.paymentZarinpalIconId],
    ["zibal", settings.paymentZibalEnabled, settings.paymentZibalIconId],
    ["torobpay", settings.paymentTorobpayEnabled, settings.paymentTorobpayIconId],
    ["nextpay", settings.paymentNextpayEnabled, settings.paymentNextpayIconId],
    ["digipay", settings.paymentDigipayEnabled, settings.paymentDigipayIconId],
    ["snappay", settings.paymentSnappayEnabled, settings.paymentSnappayIconId],
    ["behpardakht", settings.paymentBehpardakhtEnabled, settings.paymentBehpardakhtIconId],
    ["pasargad", settings.paymentPasargadEnabled, settings.paymentPasargadIconId],
    ["vandar", settings.paymentVandarEnabled, settings.paymentVandarIconId],
  ];
  return all.filter(([, enabled]) => Number(enabled) === 1).map(([id, , iconId]) => ({ id, label: LEGACY_LABELS[id], iconId: Number(iconId) || 0 }));
}

export function isGatewayEnabled(settings: SettingsShape, id: GatewayId) {
  return getPaymentGatewayOptions(settings).some((gateway) => gateway.id === id);
}
