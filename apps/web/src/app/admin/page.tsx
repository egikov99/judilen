import { DashboardView } from "@/components/admin/dashboard-view";
import { getAdminDashboardData } from "@/lib/admin-dashboard-data";
import { dashboardRange } from "@/lib/date-ranges";
import { requirePagePermission } from "@/lib/session";

export default async function AdminDashboardPage() {
  await requirePagePermission("dashboard.read");
  const range = dashboardRange("month");
  const data = await getAdminDashboardData(range.startDate, range.endDate);
  return <main className="admin-content">
    <h1 className="admin-title">Обзор</h1>
    <p className="admin-subtitle">Показатели по реальным бронированиям за выбранный период.</p>
    <DashboardView initial={data} />
  </main>;
}
