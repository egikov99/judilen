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

  console.log(`Applying ${migrationFiles.length} database migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("Database migrations completed successfully");
} catch (error) {
  console.error("Database migration failed", error);
  throw error;
} finally {
  await sqlClient.end();
}
