import { requirePermission } from "@/lib/session";
import { saveSiteTheme } from "@/lib/site-theme-db";
import { siteThemeSchema } from "@/lib/site-theme";
import { problem } from "@/lib/validation";

export async function PUT(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");

  const parsed = siteThemeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте формат HEX-цветов", parsed.error.flatten());

  return Response.json(await saveSiteTheme(parsed.data));
}
