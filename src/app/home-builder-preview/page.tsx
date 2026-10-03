import { requirePage } from "@/lib/auth";
import { getHomeBuilderState } from "@/lib/home-builder-state";
import { getHomeData } from "@/lib/home-data";
import { HomeBuilderPreview } from "@/components/HomeBuilderPreview";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
export const metadata = { title: "پیش‌نمایش صفحه اصلی", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function BuilderPreview() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const state = await getHomeBuilderState();
  return <HomeBuilderPreview initial={state.draft.blocks} data={await getHomeData(state.draft.blocks)} header={<SiteHeader/>} footer={<SiteFooter/>}/>;
}
