export type PeriodPreset = "7" | "14" | "30" | "month" | "quarter" | "custom";
export type DashboardPreset = "today" | "7" | "30" | "month" | "previous_month" | "quarter" | "year" | "custom";

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function periodRange(preset: PeriodPreset, anchor = isoDate(new Date()), customEnd?: string) {
  if (preset === "custom") return { startDate: anchor, endDate: customEnd ?? anchor };
  if (preset === "month") {
    const startDate = `${anchor.slice(0, 7)}-01`;
    const next = new Date(`${startDate}T00:00:00.000Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { startDate, endDate: addDays(isoDate(next), -1) };
  }
  if (preset === "quarter") {
    const date = new Date(`${anchor}T00:00:00.000Z`);
    const month = Math.floor(date.getUTCMonth() / 3) * 3;
    const start = new Date(Date.UTC(date.getUTCFullYear(), month, 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), month + 3, 0));
    return { startDate: isoDate(start), endDate: isoDate(end) };
  }
  return { startDate: anchor, endDate: addDays(anchor, Number(preset) - 1) };
}

export function shiftRange(startDate: string, endDate: string, direction: -1 | 1) {
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  return { startDate: addDays(startDate, days * direction), endDate: addDays(endDate, days * direction) };
}

export function validateDateRange(startDate: string | null, endDate: string | null, maxDays = 366) {
  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  return days > 0 && days <= maxDays ? { startDate, endDate, days } : null;
}

export function dashboardRange(preset: DashboardPreset, anchor = isoDate(new Date()), customEnd?: string) {
  if (preset === "today") return { startDate: anchor, endDate: anchor };
  if (preset === "custom") return { startDate: anchor, endDate: customEnd ?? anchor };
  if (preset === "month" || preset === "quarter") return periodRange(preset, anchor);
  if (preset === "previous_month") {
    const date = new Date(`${anchor.slice(0, 7)}-01T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return periodRange("month", isoDate(date));
  }
  if (preset === "year") return { startDate: `${anchor.slice(0, 4)}-01-01`, endDate: `${anchor.slice(0, 4)}-12-31` };
  return periodRange(preset, anchor);
}
