export function toDateOnlyString(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function fromDateOnlyString(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function todayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/** Calendar days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(
    (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS,
  );
}

/** Average month length in days (365.2425 / 12). */
export const DAYS_PER_MONTH = 30.436875;

/** Add calendar days to a YYYY-MM-DD date. */
export function addCalendarDays(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/** JST wall-clock date (YYYY-MM-DD) for an instant. */
export function toJstDateString(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** Add months to a YYYY-MM month. */
export function addMonthsToYearMonth(yearMonth: string, months: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Absolute month index for a YYYY-MM month. */
export function getTotalMonths(yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  return year * 12 + (month - 1);
}
