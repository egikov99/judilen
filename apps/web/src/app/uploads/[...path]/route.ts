import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { uploadRoot } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

function uploadedImagePath(segments: string[]) {
  if (segments.length !== 3) return null;
  const [scope, entityId, filename] = segments;
  if (!["houses", "services", "content", "gazebos"].includes(scope)) return null;
  if (!/^[a-z0-9-]+$/i.test(entityId)) return null;
  const match = filename.match(/^[a-z0-9-]+\.(jpg|png|webp)$/i);
  if (!match) return null;

  const root = uploadRoot();
  const path = resolve(root, scope, entityId, filename);
  if (!path.startsWith(`${root}${sep}`)) return null;
  return { path, contentType: contentTypes[match[1].toLowerCase()] };
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  const image = uploadedImagePath(segments);
  if (!image) {
    console.warn("Rejected invalid uploaded image path", { path: segments.join("/") });
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(image.path);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const stream = Readable.toWeb(createReadStream(image.path)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      console.warn("Uploaded image file is missing", { url: `/uploads/${segments.join("/")}`, path: image.path });
      return new Response("Not found", { status: 404 });
    }
    console.error("Uploaded image could not be served", { path: image.path, error });
    return new Response("Image unavailable", { status: 500 });
  }
}
