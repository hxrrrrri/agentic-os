/**
 * Google Calendar read adapter. Uses the OAuth refresh-token helper.
 *
 * Writes (event create/update/delete) intentionally omitted — must go through
 * the approval queue when added.
 */

import { getGoogleAccessToken } from "@/lib/integrations/google-oauth";

const API = "https://www.googleapis.com/calendar/v3";

async function cal<T>(path: string): Promise<T> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Calendar ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees: string[];
  htmlLink?: string;
}

interface RawEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
  htmlLink?: string;
}

function shape(e: RawEvent): CalendarEvent {
  return {
    id: e.id,
    summary: e.summary ?? "(no title)",
    description: e.description,
    location: e.location,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    htmlLink: e.htmlLink,
  };
}

export async function listUpcomingEvents(maxResults = 20, calendarId = "primary"): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
  });
  const json = await cal<{ items: RawEvent[] }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
  return (json.items ?? []).map(shape);
}

export async function listTodayAgenda(calendarId = "primary"): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  });
  const json = await cal<{ items: RawEvent[] }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
  return (json.items ?? []).map(shape);
}

export async function detectConflicts(events: CalendarEvent[]): Promise<Array<[CalendarEvent, CalendarEvent]>> {
  const out: Array<[CalendarEvent, CalendarEvent]> = [];
  const sorted = [...events].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (+new Date(b.start) >= +new Date(a.end)) break;
      out.push([a, b]);
    }
  }
  return out;
}
