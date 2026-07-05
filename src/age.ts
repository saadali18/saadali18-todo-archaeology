const DAYS_PER_MONTH = 30.4368;
const DAYS_PER_YEAR = 365.25;

export function computeAgeDays(fromDate: Date, now: Date = new Date()): number {
  const ms = now.getTime() - fromDate.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function pluralize(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** "6 years, 3 months" / "11 months" / "3 days" */
export function humanizeAgeLong(days: number): string {
  if (days < 30) return pluralize(days, "day");
  if (days < 365) return pluralize(Math.max(1, Math.round(days / DAYS_PER_MONTH)), "month");

  const years = Math.floor(days / DAYS_PER_YEAR);
  const months = Math.round((days - years * DAYS_PER_YEAR) / DAYS_PER_MONTH);
  if (months <= 0) return pluralize(years, "year");
  if (months >= 12) return pluralize(years + 1, "year");
  return `${pluralize(years, "year")}, ${pluralize(months, "month")}`;
}

/** "6y 3m" / "11m" / "3d" */
export function humanizeAgeShort(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.max(1, Math.round(days / DAYS_PER_MONTH))}m`;

  const years = Math.floor(days / DAYS_PER_YEAR);
  const months = Math.round((days - years * DAYS_PER_YEAR) / DAYS_PER_MONTH);
  if (months <= 0) return `${years}y`;
  if (months >= 12) return `${years + 1}y`;
  return `${years}y ${months}m`;
}

/** Parses CLI duration strings like "2y", "18m", "90d" into a day count. */
export function parseDurationToDays(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(y|mo?|d)$/i.exec(input.trim());
  if (!match) {
    throw new Error(`invalid duration "${input}" — use formats like "2y", "18m", "90d"`);
  }
  const value = parseFloat(match[1] as string);
  const unit = (match[2] as string).toLowerCase();
  if (unit === "y") return value * DAYS_PER_YEAR;
  if (unit === "d") return value;
  return value * DAYS_PER_MONTH;
}
