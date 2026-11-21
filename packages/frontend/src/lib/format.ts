const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

/** 金額は円の整数。null/undefined は「不明」として表示側が扱う。 */
export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return yenFormatter.format(value);
}

/** 数値入力用。空欄は null、非負整数のみ受理する。 */
export function parseYenInput(raw: string): number | null {
  const trimmed = raw.replace(/[,¥\s]/g, "");
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return NaN;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : NaN;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
}

export function formatDateWithYear(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}
