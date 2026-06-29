import { exportHouseCalendar } from "@/lib/ical-export";
import { problem } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!filename.endsWith(".ics")) return problem(404, "Календарь не найден");
  return exportHouseCalendar(request, filename.slice(0, -4));
}
