import { LoginForm } from "@/components/LoginForm";
import { ensureSeeded } from "@/lib/seed";

export const metadata = { title: "ورود" };

export default async function Login() {
  await ensureSeeded();
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-bl from-emerald-950 via-emerald-900 to-lime-800 p-4">
      <LoginForm />
    </main>
  );
}
