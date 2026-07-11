/**
 * Recurring-date helpers for birthdays and namedays: everything works on
 * day+month only, the year is ignored by design (PRD §6.1).
 */

export interface DayMonth {
  day: number;
  /** 1-12 */
  month: number;
}

/**
 * Parse a cell into day+month, ignoring the year.
 * Accepted: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd/mm, yyyy-mm-dd (ISO).
 */
export function parseDayMonth(value: string): DayMonth | null {
  const v = value.trim();
  if (!v) return null;

  // ISO: 2010-03-12 (also matches 2010-03-12T…).
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (iso) return validate(Number(iso[3]), Number(iso[2]));

  // Italian: 12/03/2010, 12-3-2010, 12.03, 12/3.
  const ita = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-]\d{2,4})?$/.exec(v);
  if (ita) return validate(Number(ita[1]), Number(ita[2]));

  return null;
}

function validate(day: number, month: number): DayMonth | null {
  return day >= 1 && day <= 31 && month >= 1 && month <= 12
    ? { day, month }
    : null;
}

/**
 * Days from `from` (midnight) to the next occurrence of day+month.
 * 0 = today. Feb 29 rolls to Mar 1 in non-leap years (Date auto-normalizes).
 */
export function daysUntilNext(dm: DayMonth, from: Date): number {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(from.getFullYear(), dm.month - 1, dm.day);
  if (next < base) {
    next = new Date(from.getFullYear() + 1, dm.month - 1, dm.day);
  }
  return Math.round((next.getTime() - base.getTime()) / 86_400_000);
}

/** True when the anniversary falls between today and +lookAheadDays. */
export function occursInWindow(
  dm: DayMonth,
  from: Date,
  lookAheadDays: number,
): boolean {
  return daysUntilNext(dm, from) <= Math.max(0, lookAheadDays);
}

/**
 * Auto-suggest the birth date column from sheet headers (PRD §6.1 regex).
 * Returns the first matching header, or null.
 */
export function suggestDateColumn(headers: string[]): string | null {
  return headers.find((h) => /birth|date|nascita|data/i.test(h)) ?? null;
}

const IT_DATE_FMT = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
});

/** "12 marzo" — used for computed placeholders. */
export function formatDayMonth(dm: DayMonth): string {
  return IT_DATE_FMT.format(new Date(2000, dm.month - 1, dm.day));
}
