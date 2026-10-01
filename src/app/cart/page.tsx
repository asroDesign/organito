import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CartView } from "@/components/CartView";
import { getUser } from "@/lib/auth";
import { db } from "@/db";
import { customerAddresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "سبد خرید" };

export default async function CartPage() {
  const u = await getUser();
  const settings = await getSettings();
  const savedAddresses = u ? await db.select().from(customerAddresses).where(eq(customerAddresses.userId,u.id)).orderBy(customerAddresses.id) : [];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold">سبد خرید</h1>
        <CartView loggedIn={!!u} defaultName={u?.name ?? ""} defaultPhone={u?.phone ?? ""} savedAddresses={savedAddresses} paymentGateway={settings.paymentGateway} />
      </main>
      <SiteFooter />
    </>
  );
}
