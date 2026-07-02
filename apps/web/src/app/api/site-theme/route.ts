import { getSiteTheme } from "@/lib/site-theme-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const theme = await getSiteTheme();
  return Response.json(theme, {
    headers: { "Cache-Control": "no-store" }
  });
}
