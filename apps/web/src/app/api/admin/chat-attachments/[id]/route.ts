import { chatAttachments, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { readStoredChatAttachment } from "@/lib/chat-attachment-storage";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function contentDisposition(kind: string, mimeType: string, fileName: string) {
  const mode = kind === "image" || mimeType === "application/pdf" ? "inline" : "attachment";
  return `${mode}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("chats.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [attachment] = await db.select().from(chatAttachments)
    .where(eq(chatAttachments.id, id))
    .limit(1);
  if (!attachment) return problem(404, "Вложение не найдено");
  try {
    const bytes = await readStoredChatAttachment(attachment.storagePath);
    return new Response(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": contentDisposition(attachment.kind, attachment.mimeType, attachment.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("chat_attachment_read_failed", { attachmentId: id, error });
    return problem(404, "Файл вложения недоступен");
  }
}
