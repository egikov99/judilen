import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { ensureExpenseReceiptRoot } from "@/lib/expense-receipts";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/session";
import { stripImageMetadata } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function receiptType(bytes: Uint8Array) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return { ext: "pdf", imageType: null };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", imageType: "jpg" as const };
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return { ext: "png", imageType: "png" as const };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { ext: "webp", imageType: "webp" as const };
  return null;
}

export async function POST(request: Request) {
  const auth = await requirePermission("expenses.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, { scope: "expense.receipt", limit: 20, windowMs: 60_000, identifier: auth.session.userId });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const maxBytes = Math.min(Number(process.env.MAX_UPLOAD_BYTES ?? 10_485_760), 10_485_760);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes + 65_536) return problem(413, "Размер файла не должен превышать 10 MB");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return problem(422, "Выберите файл чека");
  if (file.size <= 0 || file.size > maxBytes) return problem(413, "Размер файла не должен превышать 10 MB");
  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
  const type = receiptType(bytes);
  if (!type) return problem(415, "Разрешены PDF, JPEG, PNG и WEBP");
  if (type.imageType) bytes = await stripImageMetadata(bytes, type.imageType);
  const directory = await ensureExpenseReceiptRoot();
  const filename = `${randomUUID()}.${type.ext}`;
  await writeFile(`${directory}/${filename}`, bytes, { flag: "wx", mode: 0o640 });
  return Response.json({ url: `/api/admin/expense-receipts/${filename}` }, { status: 201 });
}
