import { prisma } from "./prisma.js";
export class DatabaseStore {
    async hasProcessed(eventId) {
        const event = await prisma.processedEvent.findUnique({
            where: { googleEventId: eventId }
        });
        return Boolean(event);
    }
    async markProcessed(eventId) {
        await prisma.processedEvent.upsert({
            where: { googleEventId: eventId },
            update: {},
            create: { googleEventId: eventId }
        });
    }
    async saveApproval(approval, calendarEventId) {
        await prisma.followUpApproval.upsert({
            where: { id: approval.id },
            update: {
                status: approval.status,
                calendarEventId,
                slots: {
                    deleteMany: {},
                    create: approval.slots.map((slot) => ({
                        start: slot.start,
                        end: slot.end
                    }))
                }
            },
            create: {
                id: approval.id,
                googleEventId: approval.event.id,
                contactEmail: approval.contactEmail,
                meetingSummary: approval.event.summary,
                meetingStart: approval.event.start,
                meetingEnd: approval.event.end,
                meetingTimeZone: approval.event.timeZone,
                status: approval.status,
                calendarEventId,
                createdAt: approval.createdAt,
                slots: {
                    create: approval.slots.map((slot) => ({
                        start: slot.start,
                        end: slot.end
                    }))
                }
            }
        });
    }
    async findApproval(id) {
        const approval = await prisma.followUpApproval.findUnique({
            where: { id },
            include: { slots: { orderBy: { start: "asc" } } }
        });
        if (!approval) {
            return undefined;
        }
        return {
            id: approval.id,
            contactEmail: approval.contactEmail,
            status: approval.status,
            createdAt: approval.createdAt,
            event: {
                id: approval.googleEventId,
                summary: approval.meetingSummary,
                start: approval.meetingStart,
                end: approval.meetingEnd,
                timeZone: approval.meetingTimeZone ?? undefined,
                attendees: [{ email: approval.contactEmail }]
            },
            slots: approval.slots.map((slot) => ({
                start: slot.start,
                end: slot.end
            }))
        };
    }
    async listApprovals(status) {
        return prisma.followUpApproval.findMany({
            where: status ? { status } : undefined,
            include: { slots: { orderBy: { start: "asc" } } },
            orderBy: { createdAt: "desc" }
        });
    }
}
