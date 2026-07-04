import "server-only";

import { db, settings } from "@judilen/db";
import { eq, sql } from "drizzle-orm";
import webpush from "web-push";
import { decryptCredentials, encryptCredentials } from "./credential-cipher";
import {
  resolveVapidConfiguration,
  type ResolvedVapidConfiguration,
  type VapidKeyPair
} from "./vapid-config";

const VAPID_SETTINGS_KEY = "push.vapid";

type StoredVapidValue = {
  version: 1;
  publicKey: string;
  privateKeyEncrypted: string;
  createdAt: string;
};

function parseStoredValue(value: unknown): StoredVapidValue | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StoredVapidValue>;
  if (row.version !== 1 || typeof row.publicKey !== "string" || typeof row.privateKeyEncrypted !== "string") return null;
  return {
    version: 1,
    publicKey: row.publicKey,
    privateKeyEncrypted: row.privateKeyEncrypted,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date(0).toISOString()
  };
}

export async function ensureVapidConfiguration(options: {
  forceRegenerate?: boolean;
} = {}): Promise<ResolvedVapidConfiguration> {
  const configuration = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${VAPID_SETTINGS_KEY}))`);
    return resolveVapidConfiguration({
      env: {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY
      },
      async readStored() {
        const [row] = await tx.select({ value: settings.value }).from(settings)
          .where(eq(settings.key, VAPID_SETTINGS_KEY))
          .limit(1);
        const stored = parseStoredValue(row?.value);
        if (!stored) return null;
        const decrypted = decryptCredentials(stored.privateKeyEncrypted);
        return decrypted.privateKey
          ? { publicKey: stored.publicKey, privateKey: decrypted.privateKey }
          : null;
      },
      async writeStored(keys: VapidKeyPair) {
        const value: StoredVapidValue = {
          version: 1,
          publicKey: keys.publicKey,
          privateKeyEncrypted: encryptCredentials({ privateKey: keys.privateKey }),
          createdAt: new Date().toISOString()
        };
        await tx.insert(settings).values({
          key: VAPID_SETTINGS_KEY,
          value,
          isSecret: true
        }).onConflictDoUpdate({
          target: settings.key,
          set: { value, isSecret: true, updatedAt: new Date() }
        });
      },
      generate: () => webpush.generateVAPIDKeys()
    }, options);
  });
  webpush.setVapidDetails(vapidSubject(), configuration.publicKey, configuration.privateKey);
  return configuration;
}

export function vapidSubject() {
  return process.env.VAPID_SUBJECT?.trim()
    || `mailto:${process.env.SMTP_FROM?.trim() || "admin@judilen.local"}`;
}
