import { LoginForm } from "@/components/LoginForm";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "ورود" };

export default async function Login() {
  await ensureSeeded();
  const settings = await getSettings();
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-bl from-emerald-950 via-emerald-900 to-lime-800 p-4">
      <LoginForm siteName={settings.siteName} siteLogoMediaId={Number(settings.siteLogoMediaId)} />
    </main>
  );
}
