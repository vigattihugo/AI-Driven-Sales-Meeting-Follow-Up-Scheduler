import express from "express";
import cron from "node-cron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AvailabilityAgent } from "./agents/availability-agent.js";
import { config } from "./config.js";
import { CalendarService } from "./google/calendar-service.js";
import { GmailService } from "./google/gmail-service.js";
import { FollowUpService } from "./services/follow-up-service.js";
import { DatabaseStore } from "./storage/database-store.js";
const app = express();
app.use(express.json());
const calendar = new CalendarService();
const gmail = new GmailService();
const store = new DatabaseStore();
const availabilityAgent = new AvailabilityAgent(calendar);
const followUps = new FollowUpService(calendar, gmail, availabilityAgent, store);
app.get("/health", (_request, response) => {
    response.json({ ok: true });
});
app.post("/jobs/follow-ups/run", async (_request, response, next) => {
    try {
        response.json(await followUps.run());
    }
    catch (error) {
        next(error);
    }
});
app.get("/approvals", async (request, response, next) => {
    try {
        const status = z.enum(["pending", "approved", "declined"]).optional().parse(request.query.status);
        response.json(await store.listApprovals(status));
    }
    catch (error) {
        next(error);
    }
});
app.get("/approvals/:id", async (request, response, next) => {
    try {
        const approval = await store.findApproval(request.params.id);
        if (!approval) {
            response.status(404).json({ error: "Approval not found" });
            return;
        }
        response.json(approval);
    }
    catch (error) {
        next(error);
    }
});
app.post("/approvals/:id/respond", async (request, response, next) => {
    try {
        const body = z.object({
            decision: z.enum(["approve", "decline"]),
            slotStart: z.string().datetime().optional()
        }).parse(request.body);
        response.json(await followUps.respondToApproval({
            approvalId: request.params.id,
            decision: body.decision,
            slotStart: body.slotStart
        }));
    }
    catch (error) {
        next(error);
    }
});
const webBuildPath = join(process.cwd(), "dist", "web");
if (existsSync(webBuildPath)) {
    app.use(express.static(webBuildPath));
    app.get("*", (_request, response) => {
        response.sendFile(join(webBuildPath, "index.html"));
    });
}
app.use((error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : "Unexpected error";
    response.status(400).json({ error: message });
});
cron.schedule(config.DAILY_CRON, () => {
    followUps.run().catch((error) => {
        console.error("Follow-up job failed", error);
    });
}, { timezone: config.TIMEZONE });
app.listen(config.PORT, () => {
    console.log(`Follow-up scheduler listening on http://localhost:${config.PORT}`);
});
