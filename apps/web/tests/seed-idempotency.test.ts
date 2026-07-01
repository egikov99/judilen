import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;

describe("seed deployment configuration", () => {
  it("runs access bootstrap instead of demo seed during deployment", () => {
    const root = resolve(process.cwd(), "../..");
    const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("pnpm --filter @judilen/db bootstrap");
    expect(dockerfile).not.toContain("pnpm --filter @judilen/db seed");
  });

  it("deduplicates linked records before adding unique indexes", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../packages/db/migrations/0005_deduplicate_seed_data.sql"),
      "utf8"
    );
    expect(migration).toContain("UPDATE booking_services");
    expect(migration).toContain('CREATE UNIQUE INDEX "services_title_unique"');
    expect(migration).toContain('CREATE UNIQUE INDEX "service_options_identity_unique"');
    expect(migration).toContain('CREATE UNIQUE INDEX "reviews_identity_with_house_unique"');
  });
});

describeDatabase("database seed", () => {
  it("does not add services, options or reviews when executed repeatedly", async () => {
    const { db, reviews, serviceOptions, services, sqlClient } = await import("@judilen/db");
    const root = resolve(process.cwd(), "../..");
    const counts = async () => {
      const [serviceRows, optionRows, reviewRows] = await Promise.all([
        db.select({ id: services.id }).from(services),
        db.select({ id: serviceOptions.id }).from(serviceOptions),
        db.select({ id: reviews.id }).from(reviews)
      ]);
      return {
        services: serviceRows.length,
        options: optionRows.length,
        reviews: reviewRows.length
      };
    };

    try {
      execFileSync("pnpm", ["--filter", "@judilen/db", "seed"], {
        cwd: root,
        env: process.env,
        stdio: "pipe"
      });
      const afterFirstRun = await counts();

      execFileSync("pnpm", ["--filter", "@judilen/db", "seed"], {
        cwd: root,
        env: process.env,
        stdio: "pipe"
      });
      const afterSecondRun = await counts();

      expect(afterFirstRun.services).toBeGreaterThan(0);
      expect(afterFirstRun.options).toBeGreaterThan(0);
      expect(afterFirstRun.reviews).toBeGreaterThan(0);
      expect(afterSecondRun).toEqual(afterFirstRun);
    } finally {
      await sqlClient.end();
    }
  }, 120_000);
});
