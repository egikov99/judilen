import { requirePermission } from "@/lib/session";
import { getTagManagerSettings, saveTagManagerSettings, tagManagerSettingsSchema } from "@/lib/tag-manager";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json(await getTagManagerSettings(), {
    headers: { "Cache-Control": "private, no-store" }
  });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");

  const parsed = tagManagerSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте код менеджера тегов", parsed.error.flatten());

  return Response.json(await saveTagManagerSettings(parsed.data), {
    headers: { "Cache-Control": "private, no-store" }
  });
}
