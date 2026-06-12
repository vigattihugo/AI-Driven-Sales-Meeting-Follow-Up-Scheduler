import { google } from "googleapis";
import { config } from "../config.js";
import { createGoogleAuth } from "./auth.js";
export class CalendarService {
    api;
    constructor() {
        this.api = google.calendar({ version: "v3", auth: createGoogleAuth() });
    }
    async listEvents(timeMin, timeMax) {
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
            id: event.id,
            summary: event.summary ?? "Follow-up meeting",
            start: new Date(event.start?.dateTime),
            end: new Date(event.end?.dateTime),
            timeZone: event.start?.timeZone ?? config.TIMEZONE,
            attendees: (event.attendees ?? []).map((attendee) => ({
                email: attendee.email ?? "",
                self: attendee.self ?? false
            })).filter((attendee) => attendee.email)
        }));
    }
    async listBusySlots(timeMin, timeMax) {
        const response = await this.api.freebusy.query({
            requestBody: {
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                timeZone: config.TIMEZONE,
                items: [{ id: config.GOOGLE_CALENDAR_ID }]
            }
        });
        return response.data.calendars?.[config.GOOGLE_CALENDAR_ID]?.busy?.map((busy) => ({
            start: new Date(busy.start),
            end: new Date(busy.end)
        })) ?? [];
    }
    async createMeeting(input) {
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
