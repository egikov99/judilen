export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

export type Weekday = (typeof weekdays)[number];
export type WeekdayPrices = Record<Weekday, number>;

export const weekdayLabels: Record<Weekday, string> = {
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
  sunday: "Воскресенье"
};

const jsDayToWeekday: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

export function uniformWeekdayPrices(price: number): WeekdayPrices {
  return Object.fromEntries(weekdays.map((weekday) => [weekday, price])) as WeekdayPrices;
}

export function weekdayPricesFromRows(
  rows: Array<{ weekday: Weekday; price: string | number }>,
  fallbackPrice: number
): WeekdayPrices {
  const result = uniformWeekdayPrices(fallbackPrice);
  for (const row of rows) result[row.weekday] = Number(row.price);
  return result;
}

export function weekdayPriceRange(prices: WeekdayPrices) {
  const values = weekdays.map((weekday) => prices[weekday]);
  return { minPrice: Math.min(...values), maxPrice: Math.max(...values) };
}

export interface NightlyPrice {
  date: string;
  weekday: Weekday;
  price: number;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateNightlyPrices(checkIn: string, checkOut: string, prices: WeekdayPrices): NightlyPrice[] {
  const current = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(current.getTime()) || !Number.isFinite(end.getTime()) || current >= end) return [];

  const result: NightlyPrice[] = [];
  while (current < end) {
    const weekday = jsDayToWeekday[current.getUTCDay()];
    result.push({ date: current.toISOString().slice(0, 10), weekday, price: prices[weekday] });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

export function calculateStayTotal(checkIn: string, checkOut: string, prices: WeekdayPrices) {
  const breakdown = calculateNightlyPrices(checkIn, checkOut, prices);
  return {
    breakdown,
    total: roundMoney(breakdown.reduce((sum, night) => sum + night.price, 0))
  };
}
