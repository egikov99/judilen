import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Юдилен CRM",
    short_name: "Юдилен CRM",
    description: "Управление бронированиями усадьбы «Юдилен»",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f9faf2",
    theme_color: "#154212",
    lang: "ru",
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
