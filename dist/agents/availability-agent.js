import OpenAI from "openai";
import { z } from "zod";
import { config } from "../config.js";
import { addDays, durationMinutes, isWeekend } from "../domain/date.js";
const slotsSchema = z.object({
    slots: z.array(z.object({
        start: z.string().datetime(),
        end: z.string().datetime()
    })).max(5)
});
export class AvailabilityAgent {
    calendar;
    openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    constructor(calendar) {
        this.calendar = calendar;
    }
    async suggestSlots(event) {
        const duration = durationMinutes(event.start, event.end);
        const searchStart = addDays(new Date(), 1);
        const searchEnd = addDays(new Date(), 21);
        const busySlots = await this.calendar.listBusySlots(searchStart, searchEnd);
        const candidates = this.buildCandidateSlots(event, duration, searchStart, busySlots);
        if (candidates.length <= 5) {
            return candidates;
        }
        return this.rankWithModel(event, duration, candidates);
    }
    buildCandidateSlots(event, duration, searchStart, busySlots) {
        const preferredHour = event.start.getHours();
        const preferredMinute = event.start.getMinutes();
        const slots = [];
        for (let dayOffset = 1; dayOffset <= 21 && slots.length < 12; dayOffset += 1) {
            const start = addDays(searchStart, dayOffset);
            start.setHours(preferredHour, preferredMinute, 0, 0);
            const end = new Date(start.getTime() + duration * 60_000);
            const overlaps = busySlots.some((busy) => start < busy.end && end > busy.start);
            if (!isWeekend(start) && !overlaps && start > new Date()) {
                slots.push({ start, end });
            }
        }
        return slots;
    }
    async rankWithModel(event, duration, candidates) {
        const response = await this.openai.chat.completions.create({
            model: config.OPENAI_MODEL,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "Pick up to five future meeting slots. Prefer the same weekday, time of day, and duration as the original meeting. Return JSON only."
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        previousMeeting: {
                            title: event.summary,
                            start: event.start.toISOString(),
                            end: event.end.toISOString(),
                            durationMinutes: duration
                        },
                        candidates: candidates.map((slot) => ({
                            start: slot.start.toISOString(),
                            end: slot.end.toISOString()
                        })),
                        expectedShape: { slots: [{ start: "ISO datetime", end: "ISO datetime" }] }
                    })
                }
            ]
        });
        const parsed = slotsSchema.parse(JSON.parse(response.choices[0]?.message.content ?? "{}"));
        return parsed.slots.map((slot) => ({
            start: new Date(slot.start),
            end: new Date(slot.end)
        }));
    }
}
