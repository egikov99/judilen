import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import { detectImageType } from "./uploads";
import type { IncomingChannelAttachment } from "./communication-adapters";

const attachmentDownloadLimit = 20 * 1024 * 1024;

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
  if (payload.result.file_size && payload.result.file_size > attachmentDownloadLimit) {
    throw new Error("Telegram attachment exceeds the 20 MB download limit");
  }
  return payload.result.file_path;
}

export async function downloadTelegramAttachment(
  token: string,
  channelId: string,
  attachment: IncomingChannelAttachment
) {
  if (attachment.sizeBytes && attachment.sizeBytes > attachmentDownloadLimit) {
    throw new Error("Telegram attachment exceeds the 20 MB download limit");
  }
  const filePath = await telegramFilePath(token, attachment.externalFileId);
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${encodedPath}`, {
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Telegram file download failed: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > attachmentDownloadLimit) throw new Error("Telegram attachment exceeds the 20 MB download limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > attachmentDownloadLimit) throw new Error("Telegram attachment has invalid size");
  return storeAttachment(channelId, attachment, bytes, response.headers.get("content-type"));
}

async function storeAttachment(
  channelId: string,
  attachment: IncomingChannelAttachment,
  bytes: Uint8Array,
  responseMimeType: string | null
) {
  const image = detectImageType(bytes);
  let kind: "image" | "file" = "file";
  let extension = "bin";
  let mimeType = responseMimeType?.split(";")[0] || attachment.mimeType || "application/octet-stream";
  if (image) {
    kind = "image";
    extension = image.ext;
    mimeType = image.mime;
  } else if (isPdf(bytes)) {
    extension = "pdf";
    mimeType = "application/pdf";
  } else {
    const candidate = attachment.fileName?.split(".").at(-1)?.toLowerCase() ?? "";
    extension = /^[a-z0-9]{1,8}$/.test(candidate) ? candidate : "bin";
  }

  if (!/^[a-z0-9-]+$/i.test(channelId)) throw new Error("Invalid channel id");
  const directory = `${chatAttachmentRoot()}/${channelId}`;
  await mkdir(directory, { recursive: true });
  const storagePath = `${directory}/${randomUUID()}.${extension}`;
  await writeFile(storagePath, bytes, { flag: "wx", mode: 0o640 });
  return {
    kind,
    fileName: safeDisplayName(attachment.fileName ?? "attachment"),
    mimeType,
    sizeBytes: bytes.length,
    storagePath,
    externalFileId: attachment.externalFileId
  };
}

function isAllowedVkHost(hostname: string) {
  const host = hostname.toLowerCase();
  return [
    "vk.com",
    "userapi.com",
    "vkuseraudio.net",
    "vk-cdn.net",
    "vkuser.net"
  ].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export async function downloadVkAttachment(channelId: string, attachment: IncomingChannelAttachment) {
  if (!attachment.sourceUrl) throw new Error("VK attachment URL is missing");
  if (attachment.sizeBytes && attachment.sizeBytes > attachmentDownloadLimit) {
    throw new Error("VK attachment exceeds the 20 MB download limit");
  }
  const source = new URL(attachment.sourceUrl);
  if (source.protocol !== "https:" || !isAllowedVkHost(source.hostname)) {
    throw new Error("VK attachment URL is not allowed");
  }
  const response = await fetch(source, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  const resolved = new URL(response.url);
  if (!isAllowedVkHost(resolved.hostname)) throw new Error("VK attachment redirect is not allowed");
  if (!response.ok) throw new Error(`VK file download failed: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > attachmentDownloadLimit) throw new Error("VK attachment exceeds the 20 MB download limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > attachmentDownloadLimit) throw new Error("VK attachment has invalid size");
  return storeAttachment(channelId, attachment, bytes, response.headers.get("content-type"));
}

export async function readStoredChatAttachment(storagePath: string) {
  const root = resolve(chatAttachmentRoot());
  const path = resolve(storagePath);
  if (!path.startsWith(`${root}${sep}`)) throw new Error("Invalid attachment path");
  return readFile(path);
}
