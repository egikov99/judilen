import { chatConversations, db } from "@judilen/db";
import { sql } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("chats.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [row] = await db.select({
    count: sql<number>`coalesce(sum(${chatConversations.unreadCount}), 0)::int`
  }).from(chatConversations);
  return Response.json({ count: row?.count ?? 0 });
}
