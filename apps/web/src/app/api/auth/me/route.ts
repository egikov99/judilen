import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  return session ? Response.json({ user: session }) : problem(401, "Требуется авторизация");
}

