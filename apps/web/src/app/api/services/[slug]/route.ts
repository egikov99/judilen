import { getPublicServiceBySlug } from "@/lib/services";
import { problem } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getPublicServiceBySlug(slug);
  if (!item) return problem(404, "Услуга не найдена");
  return Response.json({ item });
}
