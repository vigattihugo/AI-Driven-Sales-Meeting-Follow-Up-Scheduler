import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { formatSlot } from "../domain/date.js";
import { Approval, CalendarEvent, Slot } from "../domain/types.js";
import { AvailabilityAgent } from "../agents/availability-agent.js";
import { CalendarService } from "../google/calendar-service.js";
import { GmailService } from "../google/gmail-service.js";
import { DatabaseStore } from "../storage/database-store.js";

export class FollowUpService {
  constructor(
    private readonly calendar: CalendarService,
    private readonly gmail: GmailService,
    private readonly availabilityAgent: AvailabilityAgent,
    private readonly store: DatabaseStore
  ) {}

  async run(): Promise<{ scanned: number; approvalsSent: number }> {
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

  async respondToApproval(input: {
    approvalId: string;
    decision: "approve" | "decline";
    slotStart?: string;
  }): Promise<{ status: string; calendarEventId?: string }> {
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

  private async createApproval(
    event: CalendarEvent,
    contactEmail: string,
    slots: Slot[]
  ): Promise<Approval> {
    const approval: Approval = {
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

  private async sendApproval(approval: Approval): Promise<void> {
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

  private findExternalAttendee(event: CalendarEvent): string | undefined {
    return event.attendees.find((attendee) => !attendee.self)?.email;
  }

  private pickSlot(slots: Slot[], slotStart?: string): Slot {
    if (!slots.length) {
      throw new Error("No suggested slots available");
    }

    if (!slotStart) {
      return slots[0];
    }

    return slots.find((slot) => slot.start.toISOString() === new Date(slotStart).toISOString()) ?? slots[0];
  }

  private daysAgo(days: number, from: Date): Date {
    const date = new Date(from);
    date.setDate(date.getDate() - days);
    return date;
  }
}
