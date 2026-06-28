import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "./index";

await migrate(db, { migrationsFolder: "./migrations" });
await sqlClient.end();

