import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
const defaultPublicImageSources = [
  "https://vk.com",
  "https://*.userapi.com",
  "https://*.vk-cdn.net",
  "https://*.vkuser.net",
  "https://*.vkuserphoto.ru"
];
const publicImageSources = Array.from(new Set([
  ...defaultPublicImageSources,
  ...(process.env.PUBLIC_IMAGE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => /^[a-z0-9.-]+$/i.test(host))
    .map((host) => `https://${host}`)
]));
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${publicImageSources.length ? ` ${publicImageSources.join(" ")}` : ""}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  production ? "upgrade-insecure-requests" : ""
].filter(Boolean).join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  transpilePackages: ["@judilen/auth", "@judilen/db", "@judilen/integrations"],
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31_536_000,
    localPatterns: [
      { pathname: "/images/**" },
      { pathname: "/uploads/**" }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])
        ]
      }
    ];
  }
};

export default nextConfig;
