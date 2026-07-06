import { db, salesChannels } from "@judilen/db";
import { asc } from "drizzle-orm";
import { ReferenceDataManager } from "@/components/admin/reference-data-manager";
import { SettingsNavigation } from "@/components/admin/settings-navigation";
import { requirePagePermission } from "@/lib/session";

export default async function SalesChannelsSettingsPage() {
  await requirePagePermission("sales_channels.manage");
  const rows = await db.select().from(salesChannels).orderBy(asc(salesChannels.sortOrder), asc(salesChannels.name));
  return <main className="admin-content"><h1 className="admin-title">Каналы продаж</h1><p className="admin-subtitle">Источники бронирований, их порядок и оформление.</p><SettingsNavigation active="sales" /><ReferenceDataManager initialRows={rows} endpoint="/api/admin/sales-channels" includeSlug noun="канал" /></main>;
}
