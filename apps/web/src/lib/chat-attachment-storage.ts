import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { detectImageType } from "./uploads";
import type { IncomingChannelAttachment } from "./communication-adapters";

const telegramDownloadLimit = 20 * 1024 * 1024;

export function chatAttachmentRoot() {
  return (process.env.CHAT_ATTACHMENT_DIR || "/tmp/judilen-chat-attachments").replace(/\/+$/, "");
}

function safeDisplayName(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim();
  return (cleaned || "attachment").slice(0, 240);
}

function isPdf(bytes: Uint8Array) {
  return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

async function telegramFilePath(token: string, fileId: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
    signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json().catch(() => ({})) as {
    ok?: boolean;
    description?: string;
    result?: { file_path?: string; file_size?: number };
  };
  if (!response.ok || !payload.ok || !payload.result?.file_path) {
    throw new Error(payload.description || "Telegram getFile failed");
  }
  if (payload.result.file_size && payload.result.file_size > telegramDownloadLimit) {
    throw new Error("Telegram attachment exceeds the 20 MB download limit");
  }
  return payload.result.file_path;
}

export async function downloadTelegramAttachment(
  token: string,
  channelId: string,
  attachment: IncomingChannelAttachment
) {
  if (attachment.sizeBytes && attachment.sizeBytes > telegramDownloadLimit) {
    throw new Error("Telegram attachment exceeds the 20 MB download limit");
  }
  const filePath = await telegramFilePath(token, attachment.externalFileId);
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${encodedPath}`, {
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Telegram file download failed: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > telegramDownloadLimit) throw new Error("Telegram attachment exceeds the 20 MB download limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > telegramDownloadLimit) throw new Error("Telegram attachment has invalid size");

  const image = detectImageType(bytes);
  let kind: "image" | "file" = "file";
  let extension = "bin";
  let mimeType = attachment.mimeType || "application/octet-stream";
  if (image) {
    kind = "image";
    extension = image.ext;
    mimeType = image.mime;
  } else if (mimeType === "application/pdf" && isPdf(bytes)) {
    extension = "pdf";
  } else {
    mimeType = "application/octet-stream";
  }

  if (!/^[a-z0-9-]+$/i.test(channelId)) throw new Error("Invalid channel id");
  const directory = `${chatAttachmentRoot()}/${channelId}`;
  await mkdir(directory, { recursive: true });
  const storagePath = `${directory}/${randomUUID()}.${extension}`;
  await writeFile(storagePath, bytes, { flag: "wx", mode: 0o640 });
  return {
    kind,
    fileName: safeDisplayName(attachment.fileName),
    mimeType,
    sizeBytes: bytes.length,
    storagePath,
    externalFileId: attachment.externalFileId
  };
}

export async function readStoredChatAttachment(storagePath: string) {
  const root = chatAttachmentRoot();
  if (!storagePath.startsWith(`${root}/`)) throw new Error("Invalid attachment path");
  return readFile(storagePath);
}
