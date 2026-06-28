import type { MetadataRoute } from "next";
import { getPublishedHouses } from "@/lib/houses";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const houses = await getPublishedHouses();
  const paths = ["", "/domiki", "/uslugi", "/otzyvy", "/kontakty", "/pravila", "/privacy", "/terms"];
  return [
    ...paths.map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : .7 })),
    ...houses.map((house) => ({ url: `${base}/domiki/${house.slug}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: .9 }))
  ];
}
