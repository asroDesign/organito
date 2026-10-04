import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { LabelDesigner } from "@/components/LabelDesigner";
import { PrintDesignManager } from "@/components/PrintDesignManager";

export default async function LabelsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="مرکز طراحی چاپ" subtitle="طراحی لیبل پستی، فاکتور فروش، بارکد محصولات و مدیریت انواع محصول" />
      <LabelDesigner initial={{ labelWidth: s.labelWidth, labelHeight: s.labelHeight, labelFontSize: s.labelFontSize, labelShowBarcode: s.labelShowBarcode, labelShowSender: s.labelShowSender, labelShowItems: s.labelShowItems, labelTemplate: s.labelTemplate, senderName: s.senderName, senderAddress: s.senderAddress, siteName: s.siteName, senderPhone: s.senderPhone, senderPostalCode: s.senderPostalCode, senderCity: s.senderCity, labelShowLogo: s.labelShowLogo, labelShowOrderBarcode: s.labelShowOrderBarcode, labelBorderStyle: s.labelBorderStyle }} />
      <PrintDesignManager initial={{ productTypes: s.productTypes, invoiceWidth: s.invoiceWidth, invoiceFontSize: s.invoiceFontSize, invoiceHeaderTemplate: s.invoiceHeaderTemplate, invoiceBorderStyle: s.invoiceBorderStyle, barcodeLabelWidth: s.barcodeLabelWidth, barcodeLabelHeight: s.barcodeLabelHeight, barcodeFontSize: s.barcodeFontSize, barcodeShowProductName: s.barcodeShowProductName, barcodeShowSku: s.barcodeShowSku }} />
    </>
  );
}
