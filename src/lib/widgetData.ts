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

/**
 * Calendar events (PRD §6.3). Fixed placeholders: {titolo} {data_inizio}
 * {ora_inizio} {descrizione} {luogo}. Events already ended are dropped
 * (cached data may be hours old).
 */
export function buildCalendarItems(
  widget: Pick<CalendarWidgetConfig, "lookAheadDays" | "template">,
  payload: CalendarPayload,
  now: Date,
): RenderItem[] {
  const windowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + Math.max(0, widget.lookAheadDays) + 1,
  );
  const items: RenderItem[] = [];
  for (const event of payload.events) {
    const start = new Date(event.start);
    if (Number.isNaN(start.getTime())) continue;
    const end = new Date(event.end || event.start);
    if (end < now || start >= windowEnd) continue;
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
      }),
      daysUntil: Math.max(
        0,
        Math.round(
          (startOfEventDay.getTime() - startOfToday.getTime()) / 86_400_000,
        ),
      ),
    });
  }
  return items;
}
