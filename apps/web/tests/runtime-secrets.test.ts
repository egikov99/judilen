import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(process.cwd(), "../..");
const initScript = join(repositoryRoot, "docker/init-runtime-secrets.sh");

function readSecret(directory: string, name: string) {
  return readFileSync(join(directory, name), "utf8");
}

describe("Docker runtime secret initialization", () => {
  it("generates all secrets once and preserves them across redeploys", () => {
    const directory = mkdtempSync(join(tmpdir(), "judilen-runtime-secrets-"));
    const baseEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      RUNTIME_SECRET_DIR: directory,
      POSTGRES_PASSWORD: "",
      AUTH_SECRET: "",
      NOTIFICATION_CRON_SECRET: "",
      SEED_ADMIN_PASSWORD: ""
    };

    execFileSync("sh", [initScript], { env: baseEnvironment });
    const initial = {
      postgres: readSecret(directory, "postgres_password"),
      auth: readSecret(directory, "auth_secret"),
      notifications: readSecret(directory, "notification_cron_secret"),
      admin: readSecret(directory, "seed_admin_password")
    };

    expect(initial.postgres).toMatch(/^Pg1-[a-f0-9]{64}$/);
    expect(initial.auth).toMatch(/^Auth1-[a-f0-9]{64}$/);
    expect(initial.notifications).toMatch(/^Cron1-[a-f0-9]{64}$/);
    expect(initial.admin).toMatch(/^Adm1-[a-f0-9]{64}$/);

    execFileSync("sh", [initScript], {
      env: {
        ...baseEnvironment,
        POSTGRES_PASSWORD: "must-not-replace-existing-value",
        AUTH_SECRET: "must-not-replace-existing-value",
        NOTIFICATION_CRON_SECRET: "must-not-replace-existing-value",
        SEED_ADMIN_PASSWORD: "must-not-replace-existing-value-1"
      }
    });

    expect(readSecret(directory, "postgres_password")).toBe(initial.postgres);
    expect(readSecret(directory, "auth_secret")).toBe(initial.auth);
    expect(readSecret(directory, "notification_cron_secret")).toBe(initial.notifications);
    expect(readSecret(directory, "seed_admin_password")).toBe(initial.admin);
  });

  it("does not require Portainer secrets during Compose interpolation", () => {
    const compose = readFileSync(join(repositoryRoot, "docker-compose.yml"), "utf8");
    expect(compose).not.toContain(":?");
    expect(compose).toContain("secret-init:");
    expect(compose).toContain("runtime_secrets:/run/runtime-secrets");
    expect(compose).toContain("POSTGRES_PASSWORD_FILE");
  });
});
