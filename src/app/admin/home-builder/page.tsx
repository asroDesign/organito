import { requirePage } from "@/lib/auth";
import { getHomeBuilderState } from "@/lib/home-builder-state";
import { getHomeData } from "@/lib/home-data";
import { homeBuilderDefaults } from "@/lib/home-builder-defaults";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-page-builder";
import { HomePageBuilder } from "@/components/HomePageBuilder";
export const metadata = { title: "صفحه‌ساز پیشرفته صفحه اصلی" };
export const dynamic = "force-dynamic";
export default async function HomeBuilderPage() {
  const user = await requirePage({ perm: "SETTINGS_MANAGE" });
  const state = await getHomeBuilderState();
  const data = await getHomeData(state.draft.blocks);
  return <HomePageBuilder initial={state} categories={data.cats.map(c => ({ id: c.id, name: c.name }))} products={data.all} presetBlocks={homeBuilderDefaults(DEFAULT_HOME_LAYOUT, data.st)} userId={user.id}/>;
}
