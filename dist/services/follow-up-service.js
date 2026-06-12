import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { formatSlot } from "../domain/date.js";
export class FollowUpService {
    calendar;
    gmail;
    availabilityAgent;
    store;
    constructor(calendar, gmail, availabilityAgent, store) {
        this.calendar = calendar;
        this.gmail = gmail;
        this.availabilityAgent = availabilityAgent;
        this.store = store;
    }
    async run() {
        const now = new Date();
        const timeMin = this.daysAgo(config.LOOKBACK_START_DAYS, now);
        const timeMax = this.daysAgo(config.LOOKBACK_END_DAYS, now);
        const events = await this.calendar.listEvents(timeMin, timeMax);
        let approvalsSent = 0;
        for (const event of events) {
            if (await this.store.hasProcessed(event.id)) {
                continue;
            }
            const contactEmail = this.findExternalAttendee(event);
            if (!contactEmail) {
                await this.store.markProcessed(event.id);
                continue;
            }
            const hasConversation = await this.gmail.hasConversationSince(contactEmail, event.end);
            if (!hasConversation) {
                const slots = await this.availabilityAgent.suggestSlots(event);
                const approval = await this.createApproval(event, contactEmail, slots);
                await this.sendApproval(approval);
                approvalsSent += 1;
            }
            await this.store.markProcessed(event.id);
        }
        return { scanned: events.length, approvalsSent };
    }
    async respondToApproval(input) {
        const approval = await this.store.findApproval(input.approvalId);
        if (!approval) {
            throw new Error("Approval not found");
        }
        if (input.decision === "decline") {
            approval.status = "declined";
            await this.store.saveApproval(approval);
            return { status: "declined" };
        }
        const selectedSlot = this.pickSlot(approval.slots, input.slotStart);
        const calendarEventId = await this.calendar.createMeeting({
            summary: `Follow-up: ${approval.event.summary}`,
            description: `Follow-up generated from previous meeting ${approval.event.id}.`,
            start: selectedSlot.start,
            end: selectedSlot.end,
            attendeeEmail: approval.contactEmail
        });
        approval.status = "approved";
        await this.store.saveApproval(approval, calendarEventId);
        return { status: "approved", calendarEventId };
    }
    async createApproval(event, contactEmail, slots) {
        const approval = {
            id: randomUUID(),
            event,
            contactEmail,
            slots,
            status: "pending",
            createdAt: new Date()
        };
        await this.store.saveApproval(approval);
        return approval;
    }
    async sendApproval(approval) {
        const approveUrl = `${config.PUBLIC_BASE_URL}/approvals/${approval.id}/respond`;
        const slots = approval.slots.map((slot) => `* ${formatSlot(slot)}`).join("\n");
        await this.gmail.sendApprovalEmail({
            to: config.APPROVAL_RECIPIENT_EMAIL,
            subject: `Book a follow-up meeting with ${approval.contactEmail}?`,
            message: [
                `No follow-up was found after your last call with ${approval.contactEmail}.`,
                "",
                "Suggested slots:",
                slots || "No free slots found.",
                "",
                "Approve by sending a POST request to:",
                approveUrl,
                "",
                "Body example:",
                JSON.stringify({ decision: "approve", slotStart: approval.slots[0]?.start.toISOString() }, null, 2),
                "",
                "To dismiss:",
                JSON.stringify({ decision: "decline" }, null, 2)
            ].join("\n")
        });
    }
    findExternalAttendee(event) {
        return event.attendees.find((attendee) => !attendee.self)?.email;
    }
    pickSlot(slots, slotStart) {
        if (!slots.length) {
            throw new Error("No suggested slots available");
        }
        if (!slotStart) {
            return slots[0];
        }
        return slots.find((slot) => slot.start.toISOString() === new Date(slotStart).toISOString()) ?? slots[0];
    }
    daysAgo(days, from) {
        const date = new Date(from);
        date.setDate(date.getDate() - days);
        return date;
    }
}
