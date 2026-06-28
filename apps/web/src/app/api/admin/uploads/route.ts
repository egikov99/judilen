import { db, houseImages, houses } from "@judilen/db";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function POST(request: Request) {
  const auth = await requirePermission("houses.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const form = await request.formData();
  const file = form.get("file");
  const houseId = String(form.get("houseId") ?? "");
  const alt = String(form.get("alt") ?? "").trim();
  const position = Number(form.get("position") ?? 0);
  if (!(file instanceof File) || !houseId || alt.length < 3 || !Number.isInteger(position)) {
    return problem(422, "Требуются file, houseId, alt и целочисленный position");
  }
  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
  if (file.size <= 0 || file.size > maxBytes) return problem(413, "Файл превышает допустимый размер");
  const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, houseId)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = imageType(bytes);
  if (!detected || (file.type && file.type !== detected.mime)) return problem(415, "Допустимы PNG, JPEG и WebP");
  const uploadRoot = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads");
  const directory = join(uploadRoot, "houses", houseId);
  await mkdir(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${detected.ext}`;
  await writeFile(join(directory, filename), bytes, { flag: "wx", mode: 0o640 });
  const url = `/uploads/houses/${houseId}/${filename}`;
  const [image] = await db.insert(houseImages).values({ houseId, url, alt, position }).returning();
  await writeAudit({ session: auth.session, request, action: "house.image.upload", entityType: "house_image", entityId: image.id, after: image });
  return Response.json({ item: image }, { status: 201 });
}
