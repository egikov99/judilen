export function buildCalendarExportUrl(origin: string, houseId: string, token: string) {
  return `${origin.replace(/\/$/, "")}/api/ical/houses/${houseId}.ics?token=${encodeURIComponent(token)}`;
}
