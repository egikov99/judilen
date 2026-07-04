import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  resolveVapidConfiguration,
  VapidEnvironmentManagedError,
  type VapidKeyPair
} from "@/lib/vapid-config";

const generated: VapidKeyPair = { publicKey: "generated-public", privateKey: "generated-private" };

function dependencies(stored: VapidKeyPair | null, env: { publicKey?: string; privateKey?: string } = {}) {
  return {
    env,
    readStored: vi.fn(async () => stored),
    writeStored: vi.fn(async () => undefined),
    generate: vi.fn(() => generated)
  };
}

describe("VAPID configuration", () => {
  it("generates and persists keys on the first start", async () => {
    const deps = dependencies(null);
    const result = await resolveVapidConfiguration(deps);
    expect(result).toMatchObject({ ...generated, source: "database", automaticallyGenerated: true });
    expect(deps.generate).toHaveBeenCalledOnce();
    expect(deps.writeStored).toHaveBeenCalledWith(generated);
  });

  it("reuses persisted keys on subsequent starts", async () => {
    const stored = { publicKey: "stored-public", privateKey: "stored-private" };
    const deps = dependencies(stored);
    const result = await resolveVapidConfiguration(deps);
    expect(result).toMatchObject({ ...stored, source: "database" });
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.writeStored).not.toHaveBeenCalled();
  });

  it("gives a complete ENV pair priority over the database", async () => {
    const deps = dependencies(
      { publicKey: "stored-public", privateKey: "stored-private" },
      { publicKey: "env-public", privateKey: "env-private" }
    );
    const result = await resolveVapidConfiguration(deps);
    expect(result).toMatchObject({
      publicKey: "env-public",
      privateKey: "env-private",
      source: "env",
      automaticallyGenerated: false
    });
    expect(deps.readStored).not.toHaveBeenCalled();
  });

  it("regenerates stored keys manually but refuses to override ENV", async () => {
    const deps = dependencies({ publicKey: "old-public", privateKey: "old-private" });
    const result = await resolveVapidConfiguration(deps, { forceRegenerate: true });
    expect(result.publicKey).toBe("generated-public");
    expect(deps.writeStored).toHaveBeenCalledWith(generated);

    await expect(resolveVapidConfiguration(dependencies(null, {
      publicKey: "env-public",
      privateKey: "env-private"
    }), { forceRegenerate: true })).rejects.toBeInstanceOf(VapidEnvironmentManagedError);
  });

  it("keeps private keys encrypted and never returns them from the admin endpoint", () => {
    const server = readFileSync(resolve(process.cwd(), "src/lib/vapid.ts"), "utf8");
    const endpoint = readFileSync(resolve(process.cwd(), "src/app/api/admin/notifications/vapid/route.ts"), "utf8");
    const startup = readFileSync(resolve(process.cwd(), "src/instrumentation.ts"), "utf8");
    expect(server).toContain("encryptCredentials({ privateKey:");
    expect(server).toContain("pg_advisory_xact_lock");
    expect(endpoint).toContain('privateKeyPreview: "••••••••••••••••"');
    expect(endpoint).not.toContain("configuration.privateKey,");
    expect(endpoint.match(/requirePermission\("settings\.manage"\)/g)).toHaveLength(2);
    expect(startup).toContain("ensureVapidConfiguration");
  });
});
