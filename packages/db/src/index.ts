import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sqlClient?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    prepare: false
  });
}

export const sqlClient = globalForDb.sqlClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sqlClient = sqlClient;
export const db = drizzle(sqlClient, { schema });
export * from "./schema";

