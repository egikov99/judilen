const PUBLIC_UPLOAD_PREFIX = "/uploads/";

export const DEFAULT_IMAGE_URL = "/images/stitch/asset-025_1.jpg";

function safeLocalImagePath(value: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("\0")) return null;
  if (/^\/uploads\/(houses|services|content)\/[a-z0-9-]+\/[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(decoded)) return decoded;
  if (/^\/images\/[a-z0-9_./-]+\.(jpe?g|png|webp|avif)$/i.test(decoded)) return decoded;
  return null;
}

export function normalizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim().replaceAll("\\", "/");
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const allowedHosts = new Set((process.env.PUBLIC_IMAGE_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter((host) => /^[a-z0-9.-]+$/.test(host)));
      return url.protocol === "https:" && allowedHosts.has(url.hostname.toLowerCase())
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  const publicUploadsIndex = trimmed.toLowerCase().indexOf("/public/uploads/");
  if (publicUploadsIndex >= 0) {
    return safeLocalImagePath(`${PUBLIC_UPLOAD_PREFIX}${trimmed.slice(publicUploadsIndex + "/public/uploads/".length)}`);
  }

  const uploadsIndex = trimmed.toLowerCase().indexOf("/uploads/");
  if (uploadsIndex >= 0) {
    return safeLocalImagePath(`${PUBLIC_UPLOAD_PREFIX}${trimmed.slice(uploadsIndex + "/uploads/".length)}`);
  }

  const withoutDotPrefix = trimmed.replace(/^\.?\//, "");
  if (withoutDotPrefix.toLowerCase().startsWith("public/uploads/")) {
    return safeLocalImagePath(`${PUBLIC_UPLOAD_PREFIX}${withoutDotPrefix.slice("public/uploads/".length)}`);
  }
  if (withoutDotPrefix.toLowerCase().startsWith("uploads/")) {
    return safeLocalImagePath(`${PUBLIC_UPLOAD_PREFIX}${withoutDotPrefix.slice("uploads/".length)}`);
  }
  if (withoutDotPrefix.toLowerCase().startsWith("images/")) {
    return safeLocalImagePath(`/${withoutDotPrefix}`);
  }
  if (trimmed.startsWith("/")) return safeLocalImagePath(trimmed);

  return null;
}
