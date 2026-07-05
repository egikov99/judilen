import { communicationChannels, db } from "@judilen/db";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { disconnectCommunicationWebhook } from "@/lib/communication-adapters";
import { channelConfig } from "@/lib/communication-channels";
import { communicationProviderDefinitions, isCommunicationProvider } from "@/lib/communication-types";
import { encryptCredentials, decryptCredentials } from "@/lib/credential-cipher";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

const valuesSchema = z.record(z.string(), z.string().trim().max(4000)).default({});
const channelSchema = z.object({
  publicConfig: valuesSchema,
  secretConfig: valuesSchema
});

export async function PUT(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { provider } = await params;
  if (!isCommunicationProvider(provider)) return problem(404, "Канал не найден");
  const parsed = channelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные настройки", parsed.error.flatten());

  const [existing] = await db.select().from(communicationChannels)
    .where(eq(communicationChannels.provider, provider))
    .limit(1);
  const previousSecrets = existing ? decryptCredentials(existing.secretConfigEncrypted) : {};
  const publicConfig = Object.fromEntries(Object.entries(parsed.data.publicConfig).filter(([, value]) => value));
  const secretConfig = {
    ...previousSecrets,
    ...Object.fromEntries(Object.entries(parsed.data.secretConfig).filter(([, value]) => value))
  };
  const definition = communicationProviderDefinitions[provider];
  const missingPublic = definition.publicFields.find((field) => field.required && !publicConfig[field.key]);
  const missingSecret = definition.secretFields.find((field) => field.required && !secretConfig[field.key]);
  if (missingPublic || missingSecret) {
    return problem(422, `Заполните поле «${missingPublic?.label ?? missingSecret?.label}»`);
  }

  const values = {
    provider,
    name: definition.label,
    publicConfig,
    secretConfigEncrypted: encryptCredentials(secretConfig),
    isEnabled: true,
    status: "disconnected",
    lastError: null,
    updatedAt: new Date()
  };
  const [channel] = existing
    ? await db.update(communicationChannels).set(values)
        .where(eq(communicationChannels.id, existing.id))
        .returning()
    : await db.insert(communicationChannels).values({
        ...values,
        webhookSecret: randomBytes(24).toString("base64url")
      }).returning();
  await writeAudit({
    session: auth.session,
    request,
    action: "communication_channel.update",
    entityType: "communication_channel",
    entityId: channel.id,
    after: {
      provider,
      publicConfig,
      changedSecretKeys: Object.keys(parsed.data.secretConfig).filter((key) => parsed.data.secretConfig[key])
    }
  });
  return Response.json({ item: {
    provider,
    status: channel.status,
    isEnabled: channel.isEnabled,
    publicConfig: channel.publicConfig,
    secretKeys: Object.keys(secretConfig)
  } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { provider } = await params;
  if (!isCommunicationProvider(provider)) return problem(404, "Канал не найден");
  const [channel] = await db.select().from(communicationChannels)
    .where(eq(communicationChannels.provider, provider))
    .limit(1);
  if (!channel) return problem(404, "Подключение не найдено");
  try {
    await disconnectCommunicationWebhook(channelConfig(channel));
  } catch (error) {
    console.error("communication_webhook_disconnect_failed", { provider, error });
  }
  await db.update(communicationChannels).set({
    isEnabled: false,
    status: "disconnected",
    updatedAt: new Date()
  }).where(eq(communicationChannels.id, channel.id));
  await writeAudit({
    session: auth.session,
    request,
    action: "communication_channel.disable",
    entityType: "communication_channel",
    entityId: channel.id,
    before: { provider, isEnabled: channel.isEnabled, status: channel.status },
    after: { provider, isEnabled: false, status: "disconnected" }
  });
  return Response.json({ ok: true });
}
