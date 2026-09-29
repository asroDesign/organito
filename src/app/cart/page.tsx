import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CartView } from "@/components/CartView";
import { getUser } from "@/lib/auth";

export const metadata = { title: "سبد خرید" };

export default async function CartPage() {
  const u = await getUser();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold">سبد خرید</h1>
        <CartView loggedIn={!!u} defaultName={u?.name ?? ""} defaultPhone={u?.phone ?? ""} />
      </main>
      <SiteFooter />
    </>
  );
}
