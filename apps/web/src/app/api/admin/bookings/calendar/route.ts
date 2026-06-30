import { getAdminCalendarData } from "@/lib/admin-calendar-data";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { validateDateRange } from "@/lib/date-ranges";

export async function GET(request: Request) {
  const auth = await requirePermission("calendar.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const url = new URL(request.url);
  const range = validateDateRange(url.searchParams.get("startDate"), url.searchParams.get("endDate"));
  if (!range) return problem(422, "Укажите корректный период до 366 дней");
  return Response.json({ ...range, ...(await getAdminCalendarData(range.startDate, range.endDate)) });
}
