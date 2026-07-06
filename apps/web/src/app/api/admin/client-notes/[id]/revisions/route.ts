import { clientNoteRevisions, clientNotes, db, users } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("client_notes.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [note] = await db.select({ id: clientNotes.id }).from(clientNotes).where(eq(clientNotes.id, id)).limit(1);
  if (!note) return problem(404, "Заметка не найдена");
  const items = await db.select({
    id: clientNoteRevisions.id,
    text: clientNoteRevisions.text,
    createdAt: clientNoteRevisions.createdAt,
    authorFirstName: users.firstName,
    authorLastName: users.lastName
  }).from(clientNoteRevisions).leftJoin(users, eq(clientNoteRevisions.authorId, users.id))
    .where(eq(clientNoteRevisions.noteId, id)).orderBy(desc(clientNoteRevisions.createdAt));
  return Response.json({ items });
}
