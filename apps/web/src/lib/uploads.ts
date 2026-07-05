import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export function detectImageType(bytes: Uint8Array): { ext: "png" | "jpg" | "webp"; mime: typeof allowedImageTypes[number] } | null {
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

function concatenate(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function stripJpegMetadata(bytes: Uint8Array) {
  if (bytes.length < 4) return bytes;
  const chunks = [bytes.slice(0, 2)];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    const markerStart = offset;
    if (bytes[offset] !== 0xff) return bytes;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.slice(markerStart));
      return concatenate(chunks);
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      chunks.push(bytes.slice(markerStart, offset));
      continue;
    }
    if (offset + 2 > bytes.length) return bytes;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    const segmentEnd = offset + length;
    if (length < 2 || segmentEnd > bytes.length) return bytes;
    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!isMetadata) chunks.push(bytes.slice(markerStart, segmentEnd));
    offset = segmentEnd;
  }
  return bytes;
}

function stripPngMetadata(bytes: Uint8Array) {
  if (bytes.length < 20) return bytes;
  const chunks = [bytes.slice(0, 8)];
  const blocked = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let complete = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (!blocked.has(type)) chunks.push(bytes.slice(offset, end));
    offset = end;
    if (type === "IEND") {
      complete = true;
      break;
    }
  }
  return complete ? concatenate(chunks) : bytes;
}

function stripWebpMetadata(bytes: Uint8Array) {
  if (bytes.length <= 12) return bytes;
  const chunks: Uint8Array[] = [];
  const blocked = new Set(["EXIF", "XMP ", "ICCP"]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset + 4, true);
    const paddedLength = length + (length % 2);
    const end = offset + 8 + paddedLength;
    if (end > bytes.length) return bytes;
    const type = String.fromCharCode(...bytes.slice(offset, offset + 4));
    if (!blocked.has(type)) {
      const chunk = bytes.slice(offset, end);
      if (type === "VP8X" && chunk.length > 8) chunk[8] &= ~(0x20 | 0x08 | 0x04);
      chunks.push(chunk);
    }
    offset = end;
  }
  if (offset !== bytes.length) return bytes;
  const body = concatenate(chunks);
  const result = new Uint8Array(12 + body.length);
  result.set(bytes.slice(0, 12), 0);
  result.set(body, 12);
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  return result;
}

export function stripImageMetadata(bytes: Uint8Array, type: "jpg" | "png" | "webp") {
  if (type === "jpg") return stripJpegMetadata(bytes);
  if (type === "png") return stripPngMetadata(bytes);
  return stripWebpMetadata(bytes);
}

export function uploadRoot() {
  return resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "storage/uploads");
}

export async function saveImageFile(file: File, scope: "houses" | "services" | "content", entityId = "shared") {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateImageUpload(file, bytes, Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024));
  if (!checked.ok) return checked;
  if (!/^[a-z0-9-]+$/i.test(entityId)) return { ok: false as const, error: "path" as const };
  const directory = resolve(uploadRoot(), scope, entityId);
  const filename = `${crypto.randomUUID()}.${checked.detected.ext}`;
  const sanitizedBytes = stripImageMetadata(bytes, checked.detected.ext);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, filename), sanitizedBytes, { flag: "wx", mode: 0o640 });
    return { ok: true as const, url: `/uploads/${scope}/${entityId}/${filename}` };
  } catch (error) {
    console.error("Image upload could not be saved", { scope, entityId, directory, error });
    throw error;
  }
}

export async function removeUploadedFile(url: string) {
  if (!url.startsWith("/uploads/")) return;
  if (!/^\/uploads\/(houses|services|content)\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(url)) return;
  const path = resolve(uploadRoot(), url.slice("/uploads/".length));
  await unlink(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      console.error("Uploaded image could not be removed", { url, path, error });
      throw error;
    }
  });
}
