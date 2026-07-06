import { clientNoteRevisions, clientNotes, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { clientNoteSchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("client_notes.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = clientNoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректная заметка", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(clientNotes).where(eq(clientNotes.id, id)).limit(1);
  if (!before) return problem(404, "Заметка не найдена");
  const [item] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(clientNotes).set({ text: parsed.data.text, authorId: auth.session.userId, updatedAt: new Date() }).where(eq(clientNotes.id, id)).returning();
    await tx.insert(clientNoteRevisions).values({ noteId: id, authorId: auth.session.userId, text: parsed.data.text });
    return [updated];
  });
  await writeAudit({ session: auth.session, request, action: "client_note.update", entityType: "client_note", entityId: id, before, after: item });
  return Response.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("client_notes.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [item] = await db.delete(clientNotes).where(eq(clientNotes.id, id)).returning();
  if (!item) return problem(404, "Заметка не найдена");
  await writeAudit({ session: auth.session, request, action: "client_note.delete", entityType: "client_note", entityId: id, before: item });
  return Response.json({ item });
}
