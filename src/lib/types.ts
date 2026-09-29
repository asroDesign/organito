import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = PgDatabase<NodePgQueryResultHKT, any, any>;

export type Ctx = { userId: number | null; ip?: string | null; ua?: string | null };
