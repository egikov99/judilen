import { clientNoteRevisions, clientNotes, customers, db, users } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { clientNoteSchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("client_notes.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const items = await db.select({
    id: clientNotes.id,
    text: clientNotes.text,
    createdAt: clientNotes.createdAt,
    updatedAt: clientNotes.updatedAt,
    authorFirstName: users.firstName,
    authorLastName: users.lastName
  }).from(clientNotes).leftJoin(users, eq(clientNotes.authorId, users.id))
    .where(eq(clientNotes.clientId, id)).orderBy(asc(clientNotes.createdAt));
  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("client_notes.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = clientNoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректная заметка", parsed.error.flatten());
  const { id } = await params;
  const [customer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return problem(404, "Клиент не найден");
  const [item] = await db.transaction(async (tx) => {
    const [note] = await tx.insert(clientNotes).values({ clientId: id, authorId: auth.session.userId, text: parsed.data.text }).returning();
    await tx.insert(clientNoteRevisions).values({ noteId: note.id, authorId: auth.session.userId, text: note.text });
    return [note];
  });
  await writeAudit({ session: auth.session, request, action: "client_note.create", entityType: "client_note", entityId: item.id, after: item });
  return Response.json({ item: { ...item, authorName: auth.session.name } }, { status: 201 });
}
