import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "./index";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
const migrationFiles = readMigrationFiles({ migrationsFolder });

try {
  if (migrationFiles.length === 0) {
    throw new Error(`No database migrations found in ${migrationsFolder}`);
  }

  await migrate(db, { migrationsFolder });
} finally {
  await sqlClient.end();
}
