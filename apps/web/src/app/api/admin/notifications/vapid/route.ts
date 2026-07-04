import { auditLogs, db, pushSubscriptions } from "@judilen/db";
import { count } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { ensureVapidConfiguration } from "@/lib/vapid";
import { VapidEnvironmentManagedError } from "@/lib/vapid-config";
import { problem } from "@/lib/validation";

const regenerateSchema = z.object({
  confirm: z.literal(true)
});

function responseItem(configuration: Awaited<ReturnType<typeof ensureVapidConfiguration>>) {
  return {
    configured: true,
    publicKey: configuration.publicKey,
    privateKeyPreview: "••••••••••••••••",
    source: configuration.source,
    automaticallyGenerated: configuration.automaticallyGenerated,
    message: configuration.source === "env"
      ? "VAPID-ключи настроены через переменные окружения."
      : "VAPID-ключи настроены автоматически."
  };
}

export async function GET() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  try {
    return Response.json({ item: responseItem(await ensureVapidConfiguration()) });
  } catch (error) {
    console.error("vapid_status_failed", error);
    return Response.json({
      item: {
        configured: false,
        publicKey: null,
        privateKeyPreview: null,
        source: null,
        automaticallyGenerated: false,
        message: "Не удалось настроить VAPID-ключи."
      }
    }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = regenerateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Подтвердите перегенерацию VAPID-ключей");

  try {
    const [subscriptionCount] = await db.select({ value: count() }).from(pushSubscriptions);
    const configuration = await ensureVapidConfiguration({ forceRegenerate: true });
    await db.transaction(async (tx) => {
      await tx.delete(pushSubscriptions);
      await tx.insert(auditLogs).values({
        actorId: auth.session.userId,
        action: "vapid_keys.regenerated",
        entityType: "settings",
        entityId: "push.vapid",
        after: {
          source: configuration.source,
          publicKey: configuration.publicKey,
          invalidatedSubscriptions: Number(subscriptionCount?.value ?? 0)
        }
      });
    });
    return Response.json({
      item: responseItem(configuration),
      invalidatedSubscriptions: Number(subscriptionCount?.value ?? 0)
    });
  } catch (error) {
    if (error instanceof VapidEnvironmentManagedError) {
      return problem(409, "Ключи управляются через ENV", error.message);
    }
    console.error("vapid_regeneration_failed", error);
    return problem(500, "Не удалось перегенерировать VAPID-ключи");
  }
}
