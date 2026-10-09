import { requirePage } from "@/lib/auth";
import { getFooterBuilderState } from "@/lib/footer-builder-server";
import { FooterBuilder } from "@/components/FooterBuilder";
import { PageHeader } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function FooterBuilderPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const state = await getFooterBuilderState();
  return <><PageHeader title="فوترساز سایت" subtitle="طراحی بخش‌ها، ستون‌ها، تصاویر، نشان‌ها و محتوای پایین سایت"/><FooterBuilder initial={state.config} initialRevision={state.revision} brand={state.brand}/></>;
}
