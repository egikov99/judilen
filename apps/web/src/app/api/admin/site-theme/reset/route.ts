import { requirePermission } from "@/lib/session";
import { resetSiteTheme } from "@/lib/site-theme-db";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");

  return Response.json(await resetSiteTheme());
}
