import { mkdir, unlink, writeFile } from "node:fs/promises";

export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export function detectImageType(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return { ext: "webp", mime: "image/webp" };
  return null;
}

export function validateImageUpload(file: { name: string; type: string; size: number }, bytes: Uint8Array, maxBytes: number) {
  if (file.size <= 0 || file.size > maxBytes) return { ok: false as const, error: "size" as const };
  const detected = detectImageType(bytes);
  if (!detected || file.type !== detected.mime) return { ok: false as const, error: "type" as const };
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const validExtensions = detected.ext === "jpg" ? [".jpg", ".jpeg"] : [`.${detected.ext}`];
  if (!validExtensions.includes(extension)) return { ok: false as const, error: "extension" as const };
  return { ok: true as const, detected };
}

export function uploadRoot() {
  return (process.env.UPLOAD_DIR ?? "public/uploads").replace(/\/+$/, "");
}

export async function saveImageFile(file: File, scope: "houses" | "services" | "content", entityId = "shared") {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateImageUpload(file, bytes, Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024));
  if (!checked.ok) return checked;
  if (!/^[a-z0-9-]+$/i.test(entityId)) return { ok: false as const, error: "path" as const };
  const directory = `${uploadRoot()}/${scope}/${entityId}`;
  await mkdir(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${checked.detected.ext}`;
  await writeFile(`${directory}/${filename}`, bytes, { flag: "wx", mode: 0o640 });
  return { ok: true as const, url: `/uploads/${scope}/${entityId}/${filename}` };
}

export async function removeUploadedFile(url: string) {
  if (!url.startsWith("/uploads/")) return;
  if (!/^\/uploads\/(houses|services|content)\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(url)) return;
  const root = uploadRoot();
  await unlink(`${root}/${url.slice("/uploads/".length)}`).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
