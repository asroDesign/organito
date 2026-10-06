import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { LabelDesigner } from "@/components/LabelDesigner";
import { InvoiceDesigner } from "@/components/InvoiceDesigner";
import { BarcodeDesignManager } from "@/components/BarcodeDesignManager";

export default async function LabelsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="مرکز طراحی چاپ" subtitle="طراحی لیبل پستی، فاکتور فروش و بارکد محصولات" />
      <LabelDesigner initial={{ labelWidth: s.labelWidth, labelHeight: s.labelHeight, labelFontSize: s.labelFontSize, labelShowBarcode: s.labelShowBarcode, labelShowSender: s.labelShowSender, labelShowItems: s.labelShowItems, labelTemplate: s.labelTemplate, senderName: s.senderName, senderAddress: s.senderAddress, siteName: s.siteName, senderPhone: s.senderPhone, senderPostalCode: s.senderPostalCode, senderCity: s.senderCity, labelShowLogo: s.labelShowLogo, labelShowOrderBarcode: s.labelShowOrderBarcode, labelBorderStyle: s.labelBorderStyle }} />
      <InvoiceDesigner initial={{ siteName: s.siteName, siteTagline: s.siteTagline, siteLogoMediaId: s.siteLogoMediaId, invoiceWidth: s.invoiceWidth, invoiceFontSize: s.invoiceFontSize, invoicePadding: s.invoicePadding, invoiceHeaderTemplate: s.invoiceHeaderTemplate, invoiceBorderStyle: s.invoiceBorderStyle, invoiceBorderColor: s.invoiceBorderColor, invoiceAccentColor: s.invoiceAccentColor, invoiceFooter: s.invoiceFooter, invoiceShowLogo: s.invoiceShowLogo, invoiceShowSiteName: s.invoiceShowSiteName, invoiceShowTagline: s.invoiceShowTagline, invoiceShowHeaderTemplate: s.invoiceShowHeaderTemplate, invoiceShowInvoiceBarcode: s.invoiceShowInvoiceBarcode, invoiceShowSeller: s.invoiceShowSeller, invoiceShowBuyer: s.invoiceShowBuyer, invoiceShowOfficialInfo: s.invoiceShowOfficialInfo, invoiceShowItems: s.invoiceShowItems, invoiceShowTax: s.invoiceShowTax, invoiceShowShipping: s.invoiceShowShipping, invoiceShowPayments: s.invoiceShowPayments, invoiceShowFooter: s.invoiceShowFooter, invoiceShowSignatures: s.invoiceShowSignatures }} />
      <BarcodeDesignManager initial={{ barcodeLabelWidth: s.barcodeLabelWidth, barcodeLabelHeight: s.barcodeLabelHeight, barcodeFontSize: s.barcodeFontSize, barcodeShowProductName: s.barcodeShowProductName, barcodeShowSku: s.barcodeShowSku }} />
    </>
  );
}
