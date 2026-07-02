import { communicationChannels, db, vkIntegrations } from "@judilen/db";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { encryptCredentials } from "@/lib/credential-cipher";
import { requirePermission } from "@/lib/session";
import {
  decryptVkSecret,
  encryptVkSecret,
  isPublicHttpsCallback,
  vkCallbackUrl
} from "@/lib/vk-integration";
import { problem } from "@/lib/validation";

const inputSchema = z.object({
  groupId: z.string().trim().regex(/^\d+$/, "ID сообщества должен состоять из цифр"),
  apiVersion: z.string().trim().regex(/^5\.\d{2,3}$/, "Укажите версию в формате 5.199"),
  accessToken: z.string().trim().max(4000).optional().default(""),
  secretKey: z.string().trim().min(8).max(255).optional().or(z.literal("")).default(""),
  confirmationToken: z.string().trim().min(1).max(255).optional().or(z.literal("")).default("")
});

function responseItem(row?: typeof vkIntegrations.$inferSelect) {
  return {
    groupId: row?.groupId ?? "",
    groupName: row?.groupName ?? null,
    apiVersion: row?.apiVersion ?? "5.199",
    callbackUrl: vkCallbackUrl(),
    status: row?.status ?? "not_configured",
    hasAccessToken: Boolean(row?.accessToken),
    hasSecretKey: Boolean(row?.secretKey),
    hasConfirmationToken: Boolean(row?.confirmationToken),
    lastConfirmedAt: row?.lastConfirmedAt?.toISOString() ?? null,
    lastEventAt: row?.lastEventAt?.toISOString() ?? null
  };
}

export async function GET() {
  const auth = await requirePermission("integrations.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [row] = await db.select().from(vkIntegrations).limit(1);
  return Response.json({ item: responseItem(row) });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте настройки VK", parsed.error.flatten());

  const callbackUrl = vkCallbackUrl();
  if (process.env.NODE_ENV === "production" && !isPublicHttpsCallback(callbackUrl)) {
    return problem(422, "Для VK укажите публичный HTTPS APP_URL");
  }
  const [existing] = await db.select().from(vkIntegrations).limit(1);
  const accessToken = parsed.data.accessToken || (existing ? decryptVkSecret(existing.accessToken) : "");
  const secretKey = parsed.data.secretKey || (existing ? decryptVkSecret(existing.secretKey) : "");
  const confirmationToken = parsed.data.confirmationToken
    || (existing ? decryptVkSecret(existing.confirmationToken) : "");
  if (!accessToken || !secretKey || !confirmationToken) {
    return problem(422, "Заполните токен сообщества, секретный ключ и Confirmation token");
  }

  const now = new Date();
  const channelValues = {
    provider: "vk",
    name: "VK",
    isEnabled: true,
    status: "disconnected",
    publicConfig: { groupId: parsed.data.groupId, apiVersion: parsed.data.apiVersion },
    secretConfigEncrypted: encryptCredentials({
      accessToken,
      callbackSecret: secretKey,
      confirmationCode: confirmationToken
    }),
    lastError: null,
    updatedAt: now
  };
  const [existingChannel] = await db.select().from(communicationChannels)
    .where(eq(communicationChannels.provider, "vk"))
    .limit(1);
  const [channel] = existingChannel
    ? await db.update(communicationChannels).set(channelValues)
        .where(eq(communicationChannels.id, existingChannel.id))
        .returning()
    : await db.insert(communicationChannels).values({
        ...channelValues,
        webhookSecret: randomBytes(24).toString("base64url")
      }).returning();

  const integrationValues = {
    communicationChannelId: channel.id,
    groupId: parsed.data.groupId,
    apiVersion: parsed.data.apiVersion,
    callbackUrl,
    accessToken: encryptVkSecret(accessToken),
    secretKey: encryptVkSecret(secretKey),
    confirmationToken: encryptVkSecret(confirmationToken),
    status: "pending",
    updatedAt: now
  };
  const [row] = existing
    ? await db.update(vkIntegrations).set(integrationValues)
        .where(eq(vkIntegrations.id, existing.id))
        .returning()
    : await db.insert(vkIntegrations).values(integrationValues).returning();
  return Response.json({ item: responseItem(row) });
}

export async function DELETE() {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [row] = await db.select().from(vkIntegrations).limit(1);
  if (!row) return problem(404, "Интеграция VK не найдена");
  await Promise.all([
    db.update(vkIntegrations).set({ status: "not_configured", updatedAt: new Date() })
      .where(eq(vkIntegrations.id, row.id)),
    row.communicationChannelId
      ? db.update(communicationChannels).set({
          isEnabled: false,
          status: "disconnected",
          updatedAt: new Date()
        }).where(eq(communicationChannels.id, row.communicationChannelId))
      : Promise.resolve()
  ]);
  return Response.json({ ok: true });
}
