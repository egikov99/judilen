const PUBLIC_UPLOAD_PREFIX = "/uploads/";

export const DEFAULT_IMAGE_URL = "/images/stitch/asset-025_1.jpg";

export function normalizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim().replaceAll("\\", "/");
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const publicUploadsIndex = trimmed.toLowerCase().indexOf("/public/uploads/");
  if (publicUploadsIndex >= 0) {
    return `${PUBLIC_UPLOAD_PREFIX}${trimmed.slice(publicUploadsIndex + "/public/uploads/".length)}`;
  }

  const uploadsIndex = trimmed.toLowerCase().indexOf("/uploads/");
  if (uploadsIndex >= 0) {
    return `${PUBLIC_UPLOAD_PREFIX}${trimmed.slice(uploadsIndex + "/uploads/".length)}`;
  }

  const withoutDotPrefix = trimmed.replace(/^\.?\//, "");
  if (withoutDotPrefix.toLowerCase().startsWith("public/uploads/")) {
    return `${PUBLIC_UPLOAD_PREFIX}${withoutDotPrefix.slice("public/uploads/".length)}`;
  }
  if (withoutDotPrefix.toLowerCase().startsWith("uploads/")) {
    return `${PUBLIC_UPLOAD_PREFIX}${withoutDotPrefix.slice("uploads/".length)}`;
  }
  if (withoutDotPrefix.toLowerCase().startsWith("images/")) {
    return `/${withoutDotPrefix}`;
  }
  if (trimmed.startsWith("/")) return trimmed;

  return null;
}
