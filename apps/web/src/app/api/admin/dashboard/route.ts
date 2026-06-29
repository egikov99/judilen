import { getAdminDashboardData } from "@/lib/admin-dashboard-data";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { dashboardRange, validateDateRange } from "@/lib/date-ranges";

export async function GET(request: Request) {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const url = new URL(request.url);
  const requestedStart = url.searchParams.get("startDate");
  const requestedEnd = url.searchParams.get("endDate");
  const fallback = dashboardRange("month");
  const range = requestedStart || requestedEnd
    ? validateDateRange(requestedStart, requestedEnd)
    : { ...fallback, days: validateDateRange(fallback.startDate, fallback.endDate)!.days };
  if (!range) return problem(422, "Укажите корректный период до 366 дней");
  return Response.json(await getAdminDashboardData(range.startDate, range.endDate));
}
