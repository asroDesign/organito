import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customerAddresses } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { AddressManager } from "@/components/CustomerSelfService";

export default async function CustomerAddressesPage(){const u=await requirePage();const rows=await db.select().from(customerAddresses).where(eq(customerAddresses.userId,u.id)).orderBy(customerAddresses.id);return <AddressManager initial={rows}/>}
