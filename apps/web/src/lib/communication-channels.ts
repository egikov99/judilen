import "server-only";

import type { communicationChannels } from "@judilen/db";
import { decryptCredentials } from "./credential-cipher";
import { isCommunicationProvider } from "./communication-types";
import type { CommunicationChannelConfig } from "./communication-adapters";

export type CommunicationChannelRow = typeof communicationChannels.$inferSelect;

export function channelConfig(row: CommunicationChannelRow): CommunicationChannelConfig {
  if (!isCommunicationProvider(row.provider)) throw new Error(`Unsupported communication provider: ${row.provider}`);
  return {
    provider: row.provider,
    publicConfig: row.publicConfig,
    secretConfig: decryptCredentials(row.secretConfigEncrypted),
    webhookSecret: row.webhookSecret
  };
}

export function communicationWebhookUrl(row: Pick<CommunicationChannelRow, "provider" | "webhookSecret">) {
  const origin = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${origin}/api/webhooks/communications/${row.provider}/${row.webhookSecret}`;
}
