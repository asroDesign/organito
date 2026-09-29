import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { LabelDesigner } from "@/components/LabelDesigner";

export default async function LabelsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="طراحی لیبل پستی" subtitle="ابعاد، اجزا و متن لیبل را سفارشی کنید؛ پیش‌نمایش زنده است" />
      <LabelDesigner initial={{ labelWidth: s.labelWidth, labelHeight: s.labelHeight, labelFontSize: s.labelFontSize, labelShowBarcode: s.labelShowBarcode, labelShowSender: s.labelShowSender, labelShowItems: s.labelShowItems, labelTemplate: s.labelTemplate, senderName: s.senderName, senderAddress: s.senderAddress, siteName: s.siteName, senderPhone: s.senderPhone, senderPostalCode: s.senderPostalCode, senderCity: s.senderCity, labelShowLogo: s.labelShowLogo, labelShowOrderBarcode: s.labelShowOrderBarcode, labelBorderStyle: s.labelBorderStyle }} />
    </>
  );
}
