import { getPublicServices } from "@/lib/services";

export async function GET() {
  return Response.json({ items: await getPublicServices() });
}
