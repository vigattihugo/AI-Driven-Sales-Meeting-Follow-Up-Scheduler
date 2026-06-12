import { calendar_v3, google } from "googleapis";
import { config } from "../config.js";
import { CalendarEvent, Slot } from "../domain/types.js";
import { createGoogleAuth } from "./auth.js";

export class CalendarService {
  private readonly api: calendar_v3.Calendar;

  constructor() {
    this.api = google.calendar({ version: "v3", auth: createGoogleAuth() });
  }

  async listEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const response = await this.api.events.list({
      calendarId: config.GOOGLE_CALENDAR_ID,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime"
    });

    return (response.data.items ?? [])
      .filter((event) => event.id && event.start?.dateTime && event.end?.dateTime)
      .map((event) => ({
        id: event.id as string,
        summary: event.summary ?? "Follow-up meeting",
        start: new Date(event.start?.dateTime as string),
        end: new Date(event.end?.dateTime as string),
        timeZone: event.start?.timeZone ?? config.TIMEZONE,
        attendees: (event.attendees ?? []).map((attendee) => ({
          email: attendee.email ?? "",
          self: attendee.self ?? false
        })).filter((attendee) => attendee.email)
      }));
  }

  async listBusySlots(timeMin: Date, timeMax: Date): Promise<Slot[]> {
    const response = await this.api.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: config.TIMEZONE,
        items: [{ id: config.GOOGLE_CALENDAR_ID }]
      }
    });

    return response.data.calendars?.[config.GOOGLE_CALENDAR_ID]?.busy?.map((busy) => ({
      start: new Date(busy.start as string),
      end: new Date(busy.end as string)
    })) ?? [];
  }

  async createMeeting(input: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    attendeeEmail: string;
  }): Promise<string> {
    const response = await this.api.events.insert({
      calendarId: config.GOOGLE_CALENDAR_ID,
      sendUpdates: "all",
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString(), timeZone: config.TIMEZONE },
        end: { dateTime: input.end.toISOString(), timeZone: config.TIMEZONE },
        attendees: [{ email: input.attendeeEmail }]
      }
    });

    return response.data.id ?? "";
  }
}
