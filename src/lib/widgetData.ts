/**
 * Turns cached datasets (IndexedDB) into render-ready HTML items for each
 * widget. Pure functions: the player and the tests share this code path.
 */
import type {
  BirthdaysWidgetConfig,
  CalendarWidgetConfig,
  NamedaysWidgetConfig,
} from "./config";
import type { SheetPayload } from "./google/sheets";
import type { CalendarPayload } from "./google/calendar";
import { rowsToObjects } from "./google/sheets";
import { interpolate } from "./template";
import {
  daysUntilNext,
  formatDayMonth,
  occursInWindow,
  parseDayMonth,
} from "./dates";
import { findNameday } from "./namedays";

export interface RenderItem {
  /** Safe HTML: template with escaped values interpolated. */
  html: string;
  /** 0 = today; used for sorting. */
  daysUntil: number;
}

/**
 * Birthdays (PRD §6.1): keep rows whose date column matches today..+N days,
 * year ignored, sorted soonest first. Computed placeholders: {data_festa}.
 */
export function buildBirthdayItems(
  widget: Pick<
    BirthdaysWidgetConfig,
    "dateColumn" | "lookAheadDays" | "template"
  >,
  payload: SheetPayload,
  today: Date,
): RenderItem[] {
  const items: RenderItem[] = [];
  for (const row of rowsToObjects(payload)) {
    const dm = parseDayMonth(row[widget.dateColumn] ?? "");
    if (!dm || !occursInWindow(dm, today, widget.lookAheadDays)) continue;
    items.push({
      html: interpolate(widget.template, {
        ...row,
        data_festa: formatDayMonth(dm),
      }),
      daysUntil: daysUntilNext(dm, today),
    });
  }
  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Namedays (PRD §6.2). Source "sheet" behaves like birthdays; source
 * "builtin" resolves each name against the bundled dictionary.
 */
export function buildNamedayItems(
  widget: Pick<
    NamedaysWidgetConfig,
    "source" | "dateColumn" | "nameColumn" | "lookAheadDays" | "template"
  >,
  payload: SheetPayload,
  today: Date,
): RenderItem[] {
  if (widget.source === "sheet") {
    return buildBirthdayItems(
      {
        dateColumn: widget.dateColumn,
        lookAheadDays: widget.lookAheadDays,
        template: widget.template,
      },
      payload,
      today,
    );
  }

  const items: RenderItem[] = [];
  for (const row of rowsToObjects(payload)) {
    const name = row[widget.nameColumn] ?? "";
    const dm = findNameday(name);
    if (!dm || !occursInWindow(dm, today, widget.lookAheadDays)) continue;
    items.push({
      html: interpolate(widget.template, {
        ...row,
        data_festa: formatDayMonth(dm),
      }),
      daysUntil: daysUntilNext(dm, today),
    });
  }
  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

const IT_DATE = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const IT_TIME = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

/* Formatters used by formatPeriodo for partial date fragments. */
const IT_WEEKDAY_DAY = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
});
const IT_MONTH = new Intl.DateTimeFormat("it-IT", { month: "long" });

/**
 * Build an intelligently formatted Italian period string for a calendar event.
 *
 * Rules:
 * - All-day events: Google Calendar sends `end` as exclusive (next day).
 *   A single all-day event has end = start + 1 day → treated as single-day.
 *   Multi-day all-day events: subtract 1 day from end to get the inclusive end.
 * - Year is only included when start and end years differ.
 * - "dalle X alle Y" for same-day time ranges; "alle X" for a single time.
 * - "da ... a ..." for multi-day ranges.
 */
function formatPeriodo(start: Date, end: Date, allDay: boolean): string {
  let effectiveEnd = end;

  if (allDay) {
    // Google Calendar all-day end is exclusive; subtract 1 day for inclusive end.
    effectiveEnd = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate() - 1,
    );
  }

  const sameDay =
    start.getFullYear() === effectiveEnd.getFullYear() &&
    start.getMonth() === effectiveEnd.getMonth() &&
    start.getDate() === effectiveEnd.getDate();

  if (sameDay) {
    // Single day
    const dayStr = IT_DATE.format(start); // "domenica 12 luglio"
    if (allDay) return dayStr;
    const startTime = IT_TIME.format(start);
    const endTime = IT_TIME.format(effectiveEnd);
    if (startTime === endTime || end <= start) {
      // Only start time
      return `${dayStr} alle ${startTime}`;
    }
    return `${dayStr} dalle ${startTime} alle ${endTime}`;
  }

  // Multi-day
  const sameMonth =
    start.getMonth() === effectiveEnd.getMonth() &&
    start.getFullYear() === effectiveEnd.getFullYear();
  const sameYear = start.getFullYear() === effectiveEnd.getFullYear();

  if (allDay) {
    if (sameMonth) {
      // "da domenica 12 a martedì 14 luglio"
      return `da ${IT_WEEKDAY_DAY.format(start)} a ${IT_WEEKDAY_DAY.format(effectiveEnd)} ${IT_MONTH.format(effectiveEnd)}`;
    }
    if (sameYear) {
      // "da domenica 12 luglio a mercoledì 12 agosto"
      return `da ${IT_DATE.format(start)} a ${IT_DATE.format(effectiveEnd)}`;
    }
    // Different years: include year
    return `da ${IT_DATE.format(start)} ${start.getFullYear()} a ${IT_DATE.format(effectiveEnd)} ${effectiveEnd.getFullYear()}`;
  }

  // Multi-day with times
  const startTime = IT_TIME.format(start);
  const endTime = IT_TIME.format(effectiveEnd);

  if (sameMonth) {
    return `da ${IT_WEEKDAY_DAY.format(start)} alle ${startTime} a ${IT_WEEKDAY_DAY.format(effectiveEnd)} ${IT_MONTH.format(effectiveEnd)} alle ${endTime}`;
  }
  if (sameYear) {
    return `da ${IT_DATE.format(start)} alle ${startTime} a ${IT_DATE.format(effectiveEnd)} alle ${endTime}`;
  }
  // Different years
  return `da ${IT_DATE.format(start)} ${start.getFullYear()} alle ${startTime} a ${IT_DATE.format(effectiveEnd)} ${effectiveEnd.getFullYear()} alle ${endTime}`;
}

/**
 * Calendar events (PRD §6.3). Fixed placeholders: {titolo} {data_inizio}
 * {ora_inizio} {data_fine} {ora_fine} {periodo} {descrizione} {luogo}.
 * Events already ended are dropped (cached data may be hours old).
 *
 * `includeOngoing` (default true): when false, events already started
 * (start < now) are hidden — only upcoming ones show. `maxEvents`
 * (0/undefined = no cap): keep at most this many, soonest first.
 */
export function buildCalendarItems(
  widget: Pick<
    CalendarWidgetConfig,
    "lookAheadDays" | "template" | "maxEvents" | "includeOngoing"
  >,
  payload: CalendarPayload,
  now: Date,
): RenderItem[] {
  const windowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + Math.max(0, widget.lookAheadDays) + 1,
  );
  const includeOngoing = widget.includeOngoing ?? true;
  const items: RenderItem[] = [];
  for (const event of payload.events) {
    const start = new Date(event.start);
    if (Number.isNaN(start.getTime())) continue;
    const end = new Date(event.end || event.start);
    if (end < now || start >= windowEnd) continue;
    // Skip events already in progress unless explicitly requested.
    if (!includeOngoing && start < now) continue;
    const startOfEventDay = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    items.push({
      html: interpolate(widget.template, {
        titolo: event.title,
        descrizione: event.description,
        luogo: event.location,
        data_inizio: IT_DATE.format(start),
        ora_inizio: event.allDay ? "" : IT_TIME.format(start),
        data_fine: IT_DATE.format(new Date(
          event.allDay
            ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1).getTime()
            : end.getTime(),
        )),
        ora_fine: event.allDay ? "" : IT_TIME.format(end),
        periodo: formatPeriodo(start, end, event.allDay),
      }),
      daysUntil: Math.max(
        0,
        Math.round(
          (startOfEventDay.getTime() - startOfToday.getTime()) / 86_400_000,
        ),
      ),
    });
  }
  // Events arrive already sorted by start time (API orderBy=startTime).
  return widget.maxEvents && widget.maxEvents > 0
    ? items.slice(0, widget.maxEvents)
    : items;
}

