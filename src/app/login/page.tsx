import { LoginForm } from "@/components/LoginForm";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "ورود" };

export default async function Login() {
  await ensureSeeded();
  const settings = await getSettings();
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f1f6ef] p-3 sm:p-6 lg:p-10">
      <div aria-hidden className="pointer-events-none absolute -right-36 -top-40 size-[30rem] rounded-full bg-emerald-200/50 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 size-[32rem] rounded-full bg-lime-200/50 blur-3xl" />
      <div className="relative z-10 w-full"><LoginForm siteName={settings.siteName} siteLogoMediaId={Number(settings.siteLogoMediaId)} /></div>
    </main>
  );
}
