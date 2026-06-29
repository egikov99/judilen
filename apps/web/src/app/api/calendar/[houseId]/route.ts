import { exportHouseCalendar } from "@/lib/ical-export";

export async function GET(request: Request, { params }: { params: Promise<{ houseId: string }> }) {
  const { houseId } = await params;
  return exportHouseCalendar(request, houseId);
}
