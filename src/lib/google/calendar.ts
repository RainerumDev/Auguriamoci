/** Google Calendar API v3 connector (read-only). */
import { googleGet } from "./api";

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface CalendarEventData {
  id: string;
  title: string;
  description: string;
  location: string;
  /** ISO datetime, or ISO date for all-day events. */
  start: string;
  end: string;
  allDay: boolean;
}

export interface CalendarPayload {
  events: CalendarEventData[];
}

/** Calendars visible to the signed-in account (for the widget editor). */
export async function listCalendars(
  accessToken: string,
): Promise<CalendarListEntry[]> {
  const url =
    "https://www.googleapis.com/calendar/v3/users/me/calendarList" +
    "?fields=items(id,summary,primary)&maxResults=250";
  const data = await googleGet<{ items?: CalendarListEntry[] }>(
    url,
    accessToken,
  );
  return data.items ?? [];
}

interface ApiEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  status?: string;
}

/** Events from local midnight today up to N days ahead, expanded/sorted. */
export async function fetchEvents(
  calendarId: string,
  lookAheadDays: number,
  accessToken: string,
): Promise<CalendarPayload> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + Math.max(0, lookAheadDays) + 1);

  const params = new URLSearchParams({
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    fields: "items(id,summary,description,location,start,end,status)",
  });
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/` +
    `${encodeURIComponent(calendarId)}/events?${params}`;
  const data = await googleGet<{ items?: ApiEvent[] }>(url, accessToken);

  const events = (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e): CalendarEventData => {
      const allDay = Boolean(e.start?.date);
      return {
        id: e.id,
        title: e.summary ?? "",
        description: e.description ?? "",
        location: e.location ?? "",
        start: e.start?.dateTime ?? e.start?.date ?? "",
        end: e.end?.dateTime ?? e.end?.date ?? "",
        allDay,
      };
    });
  return { events };
}
