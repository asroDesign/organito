import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TicketThread } from "@/components/TicketThread";

export default async function CustomerTicket({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePage();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [t] = await db.select().from(tickets).where(and(eq(tickets.id, id), eq(tickets.customerId, u.id)));
  if (!t) notFound();
  return <><PageHeader title={`تیکت ${t.number}`} /><TicketThread ticketId={id} staff={false} /></>;
}
