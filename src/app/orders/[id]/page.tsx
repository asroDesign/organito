import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { OrderDetail } from "@/components/OrderDetail";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage({ role: "staff", perm: "ORDERS_VIEW" });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <OrderDetail id={id} user={u} view="admin" />;
}
