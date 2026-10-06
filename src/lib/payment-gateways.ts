import type { SettingsShape } from "./settings";

export type GatewayId = "zarinpal" | "zibal" | "torobpay";
export type PaymentGatewayOption = { id: GatewayId; label: string; iconId: number };

const LEGACY_LABELS: Record<GatewayId, string> = { zarinpal: "زرین‌پال", zibal: "زیبال", torobpay: "ترب‌پی" };

export function getPaymentGatewayOptions(settings: SettingsShape): PaymentGatewayOption[] {
  if (!settings.paymentGatewaysConfigured) {
    const id = settings.paymentGateway === "zibal" ? "zibal" : "zarinpal";
    return [{ id, label: LEGACY_LABELS[id], iconId: 0 }];
  }
  const all: [GatewayId, number, number][] = [
    ["zarinpal", settings.paymentZarinpalEnabled, settings.paymentZarinpalIconId],
    ["zibal", settings.paymentZibalEnabled, settings.paymentZibalIconId],
    ["torobpay", settings.paymentTorobpayEnabled, settings.paymentTorobpayIconId],
  ];
  return all.filter(([, enabled]) => enabled === 1).map(([id, , iconId]) => ({ id, label: LEGACY_LABELS[id], iconId }));
}

export function isGatewayEnabled(settings: SettingsShape, id: GatewayId) {
  return getPaymentGatewayOptions(settings).some((gateway) => gateway.id === id);
}
