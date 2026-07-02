import { randomBytes } from "node:crypto";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json({ secretKey: randomBytes(24).toString("base64url") });
}
