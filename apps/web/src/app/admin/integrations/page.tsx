import { calendarConflicts, db, externalCalendars, houses, integrationLogs, integrations } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { IntegrationManager } from "@/components/admin/integration-manager";
import { CommunicationIntegrationManager } from "@/components/admin/communication-integration-manager";
import { SmtpSettings } from "@/components/admin/smtp-settings";
import { buildCalendarExportUrl } from "@/lib/calendar-links";
import { requirePageAccess } from "@/lib/session";
import { redactSensitiveText } from "@/lib/redaction";

export default async function IntegrationsPage() {
  const access = await requirePageAccess("external_calendars.read");
  const canManageCalendars = access.permissions.includes("external_calendars.update");
  const [integrationRows, calendarRows, houseRows, logRows, conflictRows] = await Promise.all([
    db.select().from(integrations).orderBy(desc(integrations.createdAt)),
    db.select({ calendar: externalCalendars, houseName: houses.name }).from(externalCalendars).innerJoin(houses, eq(externalCalendars.houseId, houses.id)).orderBy(desc(externalCalendars.createdAt)),
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(houses.name),
    db.select().from(integrationLogs).orderBy(desc(integrationLogs.createdAt)).limit(30),
    db.select({
      conflict: calendarConflicts,
      houseName: houses.name,
      calendarName: externalCalendars.name
    }).from(calendarConflicts)
      .innerJoin(houses, eq(calendarConflicts.houseId, houses.id))
      .innerJoin(externalCalendars, eq(calendarConflicts.externalCalendarId, externalCalendars.id))
      .orderBy(desc(calendarConflicts.createdAt))
      .limit(100)
  ]);
  const origin = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return <main className="admin-content">
    <h1 className="admin-title">Интеграции</h1>
    <p className="admin-subtitle">Каналы сообщений, импорт внешних бронирований и экспорт занятых дат.</p>
    {access.permissions.includes("settings.manage") && <SmtpSettings />}
    <CommunicationIntegrationManager canManage={access.permissions.includes("integrations.update")} />
    <IntegrationManager
      houses={houseRows}
      canManage={canManageCalendars}
      integrations={integrationRows.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        isEnabled: item.isEnabled,
        lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
        importedCount: item.importedCount,
        errorCount: item.errorCount
      }))}
      calendars={calendarRows.map(({ calendar, houseName }) => ({
        id: calendar.id,
        integrationId: calendar.integrationId,
        houseId: calendar.houseId,
        houseName,
        provider: calendar.provider,
        name: calendar.name,
        importUrl: canManageCalendars ? calendar.importUrl : null,
        exportUrl: canManageCalendars ? buildCalendarExportUrl(origin, calendar.houseId, calendar.exportToken) : "",
        isActive: calendar.isActive,
        syncIntervalMinutes: calendar.syncIntervalMinutes,
        lastSyncAt: calendar.lastSyncAt?.toISOString() ?? null,
        lastSuccessAt: calendar.lastSuccessAt?.toISOString() ?? null,
        lastError: calendar.lastError ? redactSensitiveText(calendar.lastError) : null
      }))}
      logs={logRows.map((item) => ({
        id: item.id,
        integrationId: item.integrationId,
        level: item.level,
        message: redactSensitiveText(item.message),
        context: item.context,
        createdAt: item.createdAt.toISOString()
      }))}
      conflicts={conflictRows.map(({ conflict, ...relations }) => ({
        id: conflict.id,
        ...relations,
        source: conflict.source,
        externalUid: conflict.externalUid,
        startDate: conflict.startDate,
        endDate: conflict.endDate,
        summary: conflict.summary,
        status: conflict.status
      }))}
    />
  </main>;
}
