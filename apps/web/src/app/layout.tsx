import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Усадьба «Юдилен» — премиальный отдых в сердце природы",
    template: "%s | Усадьба «Юдилен»"
  },
  description: "Аренда уютных домиков в хвойном лесу: сауна, тишина, авторская кухня и заботливый сервис.",
  applicationName: "Усадьба «Юдилен»",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/admin-180.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Усадьба «Юдилен»",
    title: "Усадьба «Юдилен»",
    description: "Премиальный отдых в сердце природы.",
    images: [{ url: "/images/stitch/asset-025.png", width: 512, height: 512, alt: "Домик усадьбы в хвойном лесу" }]
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#154212"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
