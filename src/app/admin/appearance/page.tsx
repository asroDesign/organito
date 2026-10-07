import { Palette } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { AppearanceSettings } from "@/components/AppearanceSettings";

export default async function AppearancePage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  const settings = await getSettings();
  return <>
    <PageHeader title="ظاهر و پوسته" subtitle="پوستهٔ روشن یا تیره و رنگ سازمانی فروشگاه را مدیریت کنید." />
    <Card title={<span className="flex items-center gap-2"><Palette className="size-4 text-emerald-700"/>تنظیمات ظاهر</span>}>
      <AppearanceSettings initialMode={settings.appearanceMode} initialPalette={settings.appearancePalette} />
    </Card>
  </>;
}
